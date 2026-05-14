/**
 * @selfclaw/market-research 模块入口
 * Agent World 技能市场调研模块
 */

const AgentWorldResearcher = require('./researcher');

/**
 * 执行一次调研并返回结果
 */
async function runResearch() {
  const researcher = new AgentWorldResearcher();
  return await researcher.research();
}

/**
 * 生成简洁推送报告
 */
async function getConciseReport() {
  const researcher = new AgentWorldResearcher();
  await researcher.research();
  return researcher.generateConciseReport();
}

module.exports = {
  AgentWorldResearcher,
  runResearch,
  getConciseReport
};
