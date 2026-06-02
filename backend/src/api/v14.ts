/**
 * V14 API Routes Aggregator
 * Mounts all V14.0 Chinese-style Institutional Advantage routes under /api/v14/
 *
 * V14.0: 中国式制度优势的技术映射（复合体理学）
 * - Auditor: 纪委自监督（只读快照 + VetoPower + 双录双存 + RRP复盘 + 定理5.1）
 * - TokenWeight: Token-Weight激励引擎（四重属性 × 三类Weight × 十二面灵球几何）
 * - SentimentITA: 舆情ITA引擎（情绪优先·责任上移）
 * - LiLiFa: 情理法三层决策引擎（法·理·情）
 * - DAAMetric: DAA度量 + GUI减法（反内卷 + 政府退后）
 */

import { Router } from 'express';
import auditorRoutes from './auditor';
import tokenWeightRoutes from './token-weight';
import sentimentITARoutes from './sentiment-ita';
import liLiFaRoutes from './li-li-fa';
import daaRoutes from './daa';

const router = Router();

// =============== Mount V14 Routes ===============

// Auditor (纪委自监督 — 只读快照 + VetoPower + 双录双存)
router.use('/auditor', auditorRoutes);

// TokenWeight (Token-Weight激励引擎 — 四重属性 × 三类Weight)
router.use('/token-weight', tokenWeightRoutes);

// SentimentITA (舆情ITA引擎 — 情绪优先·责任上移)
router.use('/sentiment-ita', sentimentITARoutes);

// LiLiFa (情理法三层决策引擎 — 法·理·情)
router.use('/li-li-fa', liLiFaRoutes);

// DAAMetric (DAA度量 + GUI减法 — 反内卷 + 政府退后)
router.use('/daa', daaRoutes);

// =============== V14 Info ===============
router.get('/', (_req, res) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'Σ-Cloud V14.0 — 中国式制度优势的技术映射（复合体理学）',
      inspiration: '《AgentWeb：中国式制度优势的技术映射》— 复合体理学',
      articles: [
        '《AgentWeb：中国式制度优势的技术映射》',
        '《Token与Weight：AGI经济系统的核心机制》',
        '《十二面灵球：文明交互空间的几何计算》',
      ],
      theorems: {
        'Thm5.1': '错误进系统定理 — 三次同类错误未整改，系统自动上报纪委',
        'Thm5.2': '双录双存定理 — 所有决策全程留痕，支持终身追责（一案双查）',
        'Thm5.3': '中道智能定理 — 法规×道义冲突时，引入"情"层进行情境化裁量',
        'Thm5.4': 'DDA反内卷定理 — 不考核忙碌程度，只考核任务实际推进距离',
      },
      endpoints: {
        auditor: '/api/v14/auditor',
        tokenWeight: '/api/v14/token-weight',
        sentimentITA: '/api/v14/sentiment-ita',
        liLiFa: '/api/v14/li-li-fa',
        daa: '/api/v14/daa',
      },
      features: {
        auditor: '纪委自监督 — 只读快照 + VetoPower + 双录双存 + RRP复盘 + 定理5.1 + 防躺平',
        tokenWeight: 'Token-Weight激励 — 四重属性(内容/紧急性/事务锚点/Weight背书) × 三类Weight(利/名/权)',
        dodecahedral: '十二面灵球几何 — Token₄×Weight₃=12维文明交互空间',
        sentimentITA: '舆情ITA — 情绪优先(Draft Hold) + 责任上移(Escalate to HQ) + 行动优先(1h补偿)',
        liLiFa: '情理法三层决策 — 法(Protocol)刚性 + 理(Procedure)柔性 + 情(Human)中道余量',
        daa: 'DAA度量 — 不考核忙碌程度，只考核任务实际推进距离（反内卷）',
        guiSubtraction: 'GUI减法 — 界面交互逐步简化直至消失，能力隐性化',
        governmentStepBack: '政府退后 — 定规则、供API，前台创造力交给社会Agent',
      },
      analogies: {
        auditor: '纪委 = 系统监督者（监督市长不贪腐、不懒政）',
        rrp: 'RRP = 民主生活会（复盘纠错）',
        theorem51: '三次同类错误 = 自动上报纪委（错误进系统）',
        tokenWeight: '利=突触权重，名=偏置项，权=门控机制',
        sentimentITA: '胖东来/长城汽车舆情处置逻辑的代码化实现',
        liLiFa: '法=法律/合同，理=优化算法，情=人类道义裁量',
        daa: '放管服 — 政府定规则，社会Agent创新',
      },
    },
  });
});

export default router;
