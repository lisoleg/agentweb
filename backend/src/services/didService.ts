/**
 * DID Service - W3C DID Implementation
 * Implements did:agentweb method
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
// Simple Base58 encoding (bs58-compatible)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const Base58 = {
  encode(buffer: Buffer): string {
    let bytes = BigInt('0x' + buffer.toString('hex'));
    let result = '';
    while (bytes > 0n) {
      result = BASE58_CHARS[Number(bytes % 58n)] + result;
      bytes /= 58n;
    }
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      result = '1' + result;
    }
    return result;
  }
};
import logger from '../utils/logger';
import prisma from '../utils/prisma';

const DID_METHOD = process.env.DID_METHOD || 'agentweb';

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: any;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | any;
}

export interface DIDDocument {
  '@context': string | string[];
  id: string;
  controller?: string | string[];
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  service?: ServiceEndpoint[];
  created?: string;
  updated?: string;
}

export interface CreateDIDRequest {
  userId: string;
  metadata?: Record<string, any>;
}

export interface ResolveDIDResponse {
  did: string;
  document: DIDDocument;
  created: string;
  updated: string;
}

/**
 * Generate Ed25519 key pair
 * Returns { publicKey, privateKey } in multibase format
 */
export const generateKeyPair = (): { publicKey: string; privateKey: string; did: string } => {
  // Generate Ed25519 key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Convert to multibase (base58btc with multibase prefix)
  const publicKeyBytes = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey);
  const privateKeyBytes = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);

  // For simplicity, use base58 encoding
  const publicKeyMultibase = `z${Base58.encode(publicKeyBytes)}`;
  const privateKeyMultibase = `z${Base58.encode(privateKeyBytes)}`;

  // Generate DID from public key
  const did = `did:${DID_METHOD}:${publicKeyMultibase}`;

  return {
    publicKey: publicKeyMultibase,
    privateKey: privateKeyMultibase,
    did,
  };
};

/**
 * Create DID Document (W3C compliant)
 */
export const createDIDDocument = (
  did: string,
  publicKeyMultibase: string,
  controller?: string
): DIDDocument => {
  const now = new Date().toISOString();
  const keyId = `${did}#key-1`;

  const document: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    controller: controller || did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: controller || did,
        publicKeyMultibase,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    service: [
      {
        id: `${did}#linked-domain`,
        type: 'LinkedDomain',
        serviceEndpoint: process.env.API_URL || 'https://api.agentweb.io',
      },
    ],
    created: now,
    updated: now,
  };

  return document;
};

/**
 * Create a new DID for user
 * @param request - Create DID request
 * @returns DID and document
 */
export const createDID = async (request: CreateDIDRequest): Promise<ResolveDIDResponse> => {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { did: true },
    });

    if (!user) {
      throw new Error(`User not found: ${request.userId}`);
    }

    // Check if user already has a DID
    if (user.did) {
      logger.warn('User already has DID', { userId: request.userId, did: user.did.did });
      return {
        did: user.did.did,
        document: JSON.parse(user.did.document),
        created: user.did.createdAt.toISOString(),
        updated: user.did.updatedAt.toISOString(),
      };
    }

    // Generate key pair
    const { publicKey, privateKey, did } = generateKeyPair();

    // Create DID document
    const document = createDIDDocument(did, publicKey);

    // Store DID in database
    const didRecord = await prisma.dID.create({
      data: {
        did,
        document: JSON.stringify(document),
        controller: did,
        userId: user.id,
        verificationMethods: JSON.stringify(document.verificationMethod),
        services: JSON.stringify(document.service),
      },
    });

    // TODO: Register DID on blockchain (AgentRegistry contract)
    logger.info('DID created successfully', { did, userId: request.userId });

    return {
      did,
      document,
      created: didRecord.createdAt.toISOString(),
      updated: didRecord.updatedAt.toISOString(),
    };
  } catch (error) {
    logger.error('Failed to create DID', error);
    throw error;
  }
};

/**
 * Resolve DID to DID Document
 * @param did - DID to resolve
 * @returns DID Document
 */
export const resolveDID = async (did: string): Promise<ResolveDIDResponse> => {
  try {
    // Validate DID format
    if (!did.startsWith(`did:${DID_METHOD}:`)) {
      throw new Error(`Invalid DID method: expected did:${DID_METHOD}:...`);
    }

    // Look up DID in database
    const didRecord = await prisma.dID.findUnique({
      where: { did },
      include: { user: true },
    });

    if (!didRecord) {
      throw new Error(`DID not found: ${did}`);
    }

    const document: DIDDocument = JSON.parse(didRecord.document);

    return {
      did: didRecord.did,
      document,
      created: didRecord.createdAt.toISOString(),
      updated: didRecord.updatedAt.toISOString(),
    };
  } catch (error) {
    logger.error('Failed to resolve DID', error);
    throw error;
  }
};

/**
 * Update DID Document
 * @param did - DID to update
 * @param updates - Partial DID document updates
 * @returns Updated DID Document
 */
export const updateDID = async (
  did: string,
  updates: Partial<DIDDocument>
): Promise<ResolveDIDResponse> => {
  try {
    const didRecord = await prisma.dID.findUnique({
      where: { did },
    });

    if (!didRecord) {
      throw new Error(`DID not found: ${did}`);
    }

    // Parse current document
    const document: DIDDocument = JSON.parse(didRecord.document);

    // Apply updates
    if (updates.verificationMethod) {
      document.verificationMethod = updates.verificationMethod;
    }
    if (updates.service) {
      document.service = updates.service;
    }
    if (updates.controller) {
      document.controller = updates.controller;
    }

    // Update timestamp
    document.updated = new Date().toISOString();

    // Save to database
    const updatedRecord = await prisma.dID.update({
      where: { did },
      data: {
        document: JSON.stringify(document),
        verificationMethods: JSON.stringify(document.verificationMethod),
        services: JSON.stringify(document.service),
        updatedAt: new Date(),
      },
    });

    logger.info('DID updated successfully', { did });

    return {
      did: updatedRecord.did,
      document,
      created: updatedRecord.createdAt.toISOString(),
      updated: updatedRecord.updatedAt.toISOString(),
    };
  } catch (error) {
    logger.error('Failed to update DID', error);
    throw error;
  }
};

/**
 * Verify DID ownership (signature verification)
 * @param did - DID to verify
 * @param challenge - Challenge string
 * @param signature - Signature to verify
 * @returns True if signature is valid
 */
export const verifyDIDOwnership = async (
  did: string,
  challenge: string,
  signature: string
): Promise<boolean> => {
  try {
    const { document } = await resolveDID(did);

    // Get first verification method
    const vm = document.verificationMethod?.[0];
    if (!vm) {
      return false;
    }

    // TODO: Implement actual signature verification
    // For Ed25519, use crypto.verify()
    logger.info('DID ownership verification', { did, challenge });

    // Placeholder - implement actual verification
    return true;
  } catch (error) {
    logger.error('DID verification failed', error);
    return false;
  }
};

/**
 * Deactivate DID (revocation)
 * @param did - DID to deactivate
 */
export const deactivateDID = async (did: string): Promise<void> => {
  try {
    await prisma.dID.delete({
      where: { did },
    });

    logger.info('DID deactivated', { did });
  } catch (error) {
    logger.error('Failed to deactivate DID', error);
    throw error;
  }
};

export default {
  createDID,
  resolveDID,
  updateDID,
  verifyDIDOwnership,
  deactivateDID,
  generateKeyPair,
  createDIDDocument,
};
