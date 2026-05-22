/**
 * Labor Market Routes - V10.0 AI劳动力市场路由
 */

import { Router, Request, Response } from 'express';
import { get_instance } from '../services/aiLaborMarketService';

const router = Router();
const laborService = get_instance();

// =============== Agent Routes ===============

/**
 * POST /api/v1/labor-market/agents/register
 * 注册Agent
 */
router.post('/agents/register', (req: Request, res: Response) => {
  const { agent, skillHash, minHourlyRate, maxHoursPerWeek } = req.body;
  if (!agent || !skillHash || !minHourlyRate || maxHoursPerWeek === undefined) {
    res.status(400).json({ code: 1, message: 'agent, skillHash, minHourlyRate, and maxHoursPerWeek are required' });
    return;
  }
  try {
    const profile = laborService.registerAgent(agent, skillHash, minHourlyRate, Number(maxHoursPerWeek));
    res.json({ code: 0, data: profile, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/labor-market/agents/:agent
 * 获取Agent资料
 */
router.get('/agents/:agent', (req: Request, res: Response) => {
  const profile = laborService.getAgentProfile(req.params.agent);
  if (!profile) {
    res.status(404).json({ code: 1, message: 'Agent not found' });
    return;
  }
  res.json({ code: 0, data: profile, version: '10.0.0' });
});

// =============== Employer Routes ===============

/**
 * POST /api/v1/labor-market/employers/register
 * 注册雇主
 */
router.post('/employers/register', (req: Request, res: Response) => {
  const { employer, metadataURI } = req.body;
  if (!employer || !metadataURI) {
    res.status(400).json({ code: 1, message: 'employer and metadataURI are required' });
    return;
  }
  try {
    const profile = laborService.registerEmployer(employer, metadataURI);
    res.json({ code: 0, data: profile, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/labor-market/employers/:employer
 * 获取雇主资料
 */
router.get('/employers/:employer', (req: Request, res: Response) => {
  const profile = laborService.getEmployerProfile(req.params.employer);
  if (!profile) {
    res.status(404).json({ code: 1, message: 'Employer not found' });
    return;
  }
  res.json({ code: 0, data: profile, version: '10.0.0' });
});

// =============== Order Routes ===============

/**
 * GET /api/v1/labor-market/params
 * 获取全局参数
 */
router.get('/params', (_req: Request, res: Response) => {
  const params = laborService.getGlobalParams();
  res.json({ code: 0, data: params, version: '10.0.0' });
});

/**
 * POST /api/v1/labor-market/orders
 * 创建劳动订单
 */
router.post('/orders', (req: Request, res: Response) => {
  const { employer, description, requirementsHash, hourlyRate, estimatedHours, maxHours, deadline } = req.body;
  if (!employer || !description || !hourlyRate || estimatedHours === undefined || maxHours === undefined || !deadline) {
    res.status(400).json({ code: 1, message: 'employer, description, hourlyRate, estimatedHours, maxHours, and deadline are required' });
    return;
  }
  try {
    const order = laborService.createOrder(employer, description, requirementsHash || '', hourlyRate, Number(estimatedHours), Number(maxHours), Number(deadline));
    res.json({ code: 0, data: order, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/labor-market/orders/:orderId/confirm
 * 确认接受订单
 */
router.post('/orders/:orderId/confirm', (req: Request, res: Response) => {
  const { agent } = req.body;
  if (!agent) {
    res.status(400).json({ code: 1, message: 'agent is required' });
    return;
  }
  try {
    const order = laborService.confirmOrder(Number(req.params.orderId), agent);
    res.json({ code: 0, data: order, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/labor-market/orders/:orderId/complete
 * 完成订单
 */
router.post('/orders/:orderId/complete', (req: Request, res: Response) => {
  const { actualHours } = req.body;
  if (actualHours === undefined) {
    res.status(400).json({ code: 1, message: 'actualHours is required' });
    return;
  }
  try {
    const order = laborService.completeOrder(Number(req.params.orderId), Number(actualHours));
    res.json({ code: 0, data: order, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/labor-market/orders/:orderId/cancel
 * 取消订单
 */
router.post('/orders/:orderId/cancel', (req: Request, res: Response) => {
  const { reason } = req.body;
  try {
    const order = laborService.cancelOrder(Number(req.params.orderId), reason || 'Cancelled');
    res.json({ code: 0, data: order, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/labor-market/orders/:orderId
 * 获取订单详情
 */
router.get('/orders/:orderId', (req: Request, res: Response) => {
  const order = laborService.getOrder(Number(req.params.orderId));
  if (!order) {
    res.status(404).json({ code: 1, message: 'Order not found' });
    return;
  }
  res.json({ code: 0, data: order, version: '10.0.0' });
});

// =============== Dispute Routes ===============

/**
 * POST /api/v1/labor-market/disputes
 * 提交争议
 */
router.post('/disputes', (req: Request, res: Response) => {
  const { orderId, filer, reason } = req.body;
  if (!orderId || !filer || !reason) {
    res.status(400).json({ code: 1, message: 'orderId, filer, and reason are required' });
    return;
  }
  try {
    const dispute = laborService.fileDispute(Number(orderId), filer, reason);
    res.json({ code: 0, data: dispute, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/labor-market/disputes/:disputeId/resolve
 * 解决争议
 */
router.post('/disputes/:disputeId/resolve', (req: Request, res: Response) => {
  const { outcome } = req.body;
  if (!outcome) {
    res.status(400).json({ code: 1, message: 'outcome is required' });
    return;
  }
  try {
    const dispute = laborService.resolveDispute(Number(req.params.disputeId), outcome);
    res.json({ code: 0, data: dispute, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

export default router;
