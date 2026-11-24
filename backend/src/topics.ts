export const topicOptions = [
  '跨境资金与金融合规', '贸易与海关合规', '矿产政策与供应链尽调',
  '环境、气候与矿山安全', '数据跨境与隐私', '企业运营与治理', '其他',
] as const

const aliases = [
  ['资金', '跨境资金', '项目融资', '项目融资合规', '反洗钱', '反洗钱与制裁', '制裁与交易筛查'],
  ['关税', '关税与贸易', '税收政策', '出口管制', '海关与物流安全', '通关与物流安全'],
  ['关键矿产', '关键矿产政策', '关键矿产供应', '冲突矿产', '供应链尽调', '责任采购', '人权与环境尽调', '劳工与人权', '新能源材料合规', '责任矿业标准'],
  ['碳排放', '环保合规', '环保与碳排放', '环境社会管理', '气候披露', '危废', '危废与跨境转移', '尾矿', '尾矿与环境安全', '生物多样性', '安全生产'],
  ['数据跨境', '数据与隐私', '数据出境', '个人信息保护'],
  ['企业动态', '透明度与反腐败', '负责任商业行为', '出海服务'],
]
type Topic = (typeof topicOptions)[number]
export const topicAliases = new Map<string, Topic>(topicOptions.flatMap((topic, index) =>
  [topic, ...(aliases[index] ?? [])].map(alias => [alias, topic] as const)))
export const otherTopic = topicOptions[6]
export function knownTopic(category: string) {
  return topicAliases.has(category)
}
export function resolveTopic(category: string, topic: Topic | null) {
  return topic ?? topicAliases.get(category) ?? otherTopic
}
