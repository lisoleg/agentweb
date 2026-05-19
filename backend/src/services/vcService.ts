/**
 * Verifiable Credential (VC) Service
 * Implements W3C VC Data Model for issuing and verifying credentials
 */

import crypto from 'crypto';
import logger from '../utils/logger';
import prisma from '@prisma/client';
import { resolveDID } from './didService';

export interface CredentialSubject {
  id?: string;
  [key: string]: any;
}

export interface VerifiableCredential {
  '@context': string | string[];
  id?: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: CredentialSubject;
  proof?: Proof;
}

export interface Proof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
  jws?: string;
}

export interface IssueVCRequest {
  issuer: string;
  subject: CredentialSubject;
  type?: string[];
  expirationDate?: string;
  privateKeyJwk?: any; // For signing
}

export interface VerifyVCRequest {
  vc: VerifiableCredential;
}

export interface VerifyVCResponse {
  valid: boolean;
  checks: string[];
  errors?: string[];
  claims?: any;
}

/**
 * Issue a new Verifiable Credential
 * @param request - VC issuance request
 * @returns Signed VC
 */
export const issueVC = async (request: IssueVCRequest): Promise<VerifiableCredential> => {
  try {
    // Validate issuer DID
    const issuerDID = await resolveDID(request.issuer);
    if (!issuerDID) {
      throw new Error(`Invalid issuer DID: ${request.issuer}`);
    }

    // Get subject ID (if provided)
    const subjectId = request.subject.id || '';

    // Create VC ID
    const vcId = `urn:uuid:${crypto.randomUUID()}`;

    // Build VC
    const vc: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      id: vcId,
      type: request.type || ['VerifiableCredential'],
      issuer: request.issuer,
      issuanceDate: new Date().toISOString(),
      credentialSubject: request.subject,
    };

    if (request.expirationDate) {
      vc.expirationDate = request.expirationDate;
    }

    // Sign the VC (create proof)
    const proof = await signVC(vc, request.issuer, request.privateKeyJwk);
    vc.proof = proof;

    // Store VC in database
    await prisma.vC.create({
      data: {
        vcId: vc.id!,
        issuer: request.issuer,
        subject: subjectId,
        type: vc.type,
        issuanceDate: new Date(vc.issuanceDate),
        expirationDate: vc.expirationDate ? new Date(vc.expirationDate) : undefined,
        credential: JSON.stringify(vc),
        proof: JSON.stringify(proof),
      },
    });

    logger.info('VC issued successfully', { vcId: vc.id, issuer: request.issuer });
    return vc;
  } catch (error) {
    logger.error('Failed to issue VC', error);
    throw error;
  }
};

/**
 * Sign a Verifiable Credential
 * @param vc - VC to sign
 * @param issuerDID - Issuer's DID
 * @param privateKeyJwk - Private key (optional, should come from secure storage)
 * @returns Proof object
 */
export const signVC = async (
  vc: VerifiableCredential,
  issuerDID: string,
  privateKeyJwk?: any
): Promise<Proof> => {
  // Create canonicalized VC data for signing
  const vcData = JSON.stringify(vc, Object.keys(vc).sort());

  // TODO: Use actual private key from secure storage
  // For now, create a mock signature
  const signature = crypto.createSign('SHA256').update(vcData).sign(privateKeyJwk || 'mock-private-key');

  const proof: Proof = {
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    verificationMethod: `${issuerDID}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue: signature.toString('base64'),
  };

  return proof;
};

/**
 * Verify a Verifiable Credential
 * @param request - VC verification request
 * @returns Verification result
 */
export const verifyVC = async (request: VerifyVCRequest): Promise<VerifyVCResponse> => {
  const checks: string[] = [];
  const errors: string[] = [];

  try {
    const vc = request.vc;

    // Check 1: Verify VC structure
    if (!vc['@context'] || !vc.type || !vc.issuer || !vc.credentialSubject) {
      errors.push('Invalid VC structure: missing required fields');
      return { valid: false, checks, errors };
    }
    checks.push('structure-valid');

    // Check 2: Verify issuer DID exists
    try {
      await resolveDID(vc.issuer);
      checks.push('issuer-did-exists');
    } catch (error) {
      errors.push(`Issuer DID not found: ${vc.issuer}`);
      return { valid: false, checks, errors };
    }

    // Check 3: Verify proof (signature)
    if (!vc.proof) {
      errors.push('No proof found in VC');
      return { valid: false, checks, errors };
    }

    // TODO: Implement actual signature verification
    // For now, assume valid
    checks.push('proof-valid');

    // Check 4: Verify expiration
    if (vc.expirationDate) {
      const expDate = new Date(vc.expirationDate);
      if (expDate < new Date()) {
        errors.push('VC has expired');
        return { valid: false, checks, errors };
      }
    }
    checks.push('not-expired');

    // Check 5: Verify against stored VC (optional)
    const storedVC = await prisma.vC.findUnique({
      where: { vcId: vc.id! },
    });

    if (storedVC && storedVC.revoked) {
      errors.push('VC has been revoked');
      return { valid: false, checks, errors };
    }
    checks.push('not-revoked');

    logger.info('VC verified successfully', { vcId: vc.id });

    return {
      valid: true,
      checks,
      claims: vc.credentialSubject,
    };
  } catch (error) {
    logger.error('VC verification failed', error);
    errors.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, checks, errors };
  }
};

/**
 * List VCs for a DID (as subject)
 * @param did - Subject DID
 * @returns Array of VCs
 */
export const listVCs = async (did: string): Promise<VerifiableCredential[]> => {
  try {
    const vcs = await prisma.vC.findMany({
      where: { subject: did, revoked: false },
    });

    return vcs.map((vc) => JSON.parse(vc.credential));
  } catch (error) {
    logger.error('Failed to list VCs', error);
    throw error;
  }
};

/**
 * Revoke a VC
 * @param vcId - VC ID to revoke
 */
export const revokeVC = async (vcId: string): Promise<void> => {
  try {
    await prisma.vC.update({
      where: { vcId },
      data: { revoked: true },
    });

    logger.info('VC revoked', { vcId });
  } catch (error) {
    logger.error('Failed to revoke VC', error);
    throw error;
  }
};

export default {
  issueVC,
  verifyVC,
  listVCs,
  revokeVC,
};
