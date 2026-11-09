/**
 * Demo transcript for the dsh-ui-outline demo video.
 *
 * One coherent 36-turn conversation about attention / long-context inference.
 * The turn count is deliberate: `compact` pitch is 10px (360px rail) and
 * `loose` pitch is 30px (1080px rail, internally scrollable), so the clip can
 * show both densities without a contrived second conversation.
 *
 * The answers double as the hover-preview text and the ⌘F search corpus, so
 * they stay within the rail's 160-char preview budget.
 */
export const TITLE = "注意力机制与长上下文推理";

export const TURNS = [
	{
		prompt: "帮我系统梳理一下 Transformer 的注意力机制，从最基础的形式开始。",
		answer: "注意力把查询和一组键做匹配，再用匹配分数对值加权求和。最基础的是缩放点积注意力：QKᵀ 得到相似度，除以 √d_k 稳定数值，softmax 归一化后乘 V。Transformer 的堆叠，本质上是这个算子的组合。",
	},
	{
		prompt: "把缩放点积注意力的公式写出来，每一项代表什么？",
		answer: "Attention(Q,K,V)=softmax(QKᵀ/√d_k)V。Q 是查询，K 是键，V 是值；QKᵀ 的第 (i,j) 项是第 i 个查询与第 j 个键的相关性；softmax 按行归一化；最后用权重对 V 加权求和。",
	},
	{
		prompt: "为什么要除以根号 d_k？不除会怎样？",
		answer: "若 q、k 各维独立同分布、方差为 1，点积方差随 d_k 线性增长。不缩放时分数过大，softmax 进入饱和区，梯度几乎消失。除以 √d_k 把方差拉回 1 附近。",
	},
	{
		prompt: "多头注意力到底解决了什么问题？",
		answer: "单头只能学一种关注模式。多头把表示投影到多组子空间，各自计算注意力再拼接，让模型同时关注局部搭配、长距离依赖和语法角色，表达容量更大。",
	},
	{
		prompt: "位置编码为什么不能只用正弦函数？现在的模型都用什么？",
		answer: "正弦编码能表达相对位置，但外推性和表达灵活性有限。现在主流是 RoPE 旋转位置编码，把位置信息旋转进 q、k；也有 ALiBi 这类加性偏置方案。",
	},
	{
		prompt: "解释一下自回归生成时的因果掩码是怎么实现的。",
		answer: "在 softmax 之前把上三角位置置为 −∞，让第 t 个 token 只能看到 ≤t 的位置。实现上通常用一个下三角布尔掩码加到注意力分数上，再统一做 softmax。",
	},
	{
		prompt: "KV Cache 缓存的是什么？为什么能加速推理？",
		answer: "缓存每一层已经算过的 K 和 V，新 token 只计算自己的 q、k、v，然后与历史 K/V 做注意力。避免重复计算前缀，把每步复杂度从 O(n²) 降到 O(n)。",
	},
	{
		prompt: "长上下文时 KV Cache 的显存怎么估算？",
		answer: "约等于 2 × 层数 × 头数 × 头维度 × 序列长度 × batch × 每元素字节数。以 7B、32 层、4096 维、fp16、32k 上下文为例，单条序列就要十几 GB。",
	},
	{
		prompt: "有哪些主流的 KV Cache 压缩方法？各自代价是什么？",
		answer: "常见有量化（INT8/INT4）、token 驱逐（H2O、StreamingLLM）、低秩压缩（MLA）、跨层共享。量化省显存但伤精度；驱逐快但可能丢关键信息；MLA 需要改训练。",
	},
	{
		prompt: "PagedAttention 的核心思想是什么？",
		answer: "把 KV Cache 切成固定大小的 block，用页表按需映射到显存，像操作系统管理内存一样消除碎片。vLLM 借此把吞吐提升数倍，并支持前缀共享。",
	},
	{
		prompt: "投机解码和 KV Cache 可以一起用吗？",
		answer: "可以。草稿模型先生成若干候选 token，大模型一次前向并行验证；被接受的 token 直接写入 KV Cache，被拒绝的部分回滚。两者正交，组合后延迟明显下降。",
	},
	{
		prompt: "解释一下 FlashAttention 的分块策略。",
		answer: "把 Q、K、V 切成能放进 SRAM 的小块，外层遍历 K/V 块、内层遍历 Q 块，在线更新 softmax 的归一化因子和输出，避免把完整注意力矩阵写回 HBM。",
	},
	{
		prompt: "为什么 FlashAttention 能省显存但不改变计算量？",
		answer: "它不改变 O(n²) 的乘加次数，只是把中间矩阵留在片上内存、用重计算换访存。瓶颈从 HBM 带宽变成计算，所以 wall-clock 仍然大幅下降。",
	},
	{
		prompt: "训练时常用哪些并行策略？数据并行和模型并行的边界在哪？",
		answer: "数据并行复制模型、切分 batch；张量并行切单层权重；流水并行切层；序列并行切 token 维。选择取决于模型是否能放进单卡，以及互连带宽。",
	},
	{
		prompt: "张量并行里注意力的切分具体怎么落？",
		answer: "多头注意力按头切分：每张卡负责一部分头和对应的 Q/K/V 投影，输出投影按输入维切分后 all-reduce。MLP 通常按隐藏维切分，前后各一次通信。",
	},
	{
		prompt: "混合专家模型（MoE）的路由是怎么训练的？",
		answer: "每个 token 经门控网络对专家打分，取 top-k 加权求和。训练时加负载均衡损失，防止专家塌缩；再用容量因子和 drop 策略控制单专家负载。",
	},
	{
		prompt: "MoE 推理时专家并行会带来哪些通信开销？",
		answer: "token 需要按路由结果 all-to-all 分发到持有对应专家的设备，算完再 all-to-all 收回。专家越多、并行度越高，通信占比越大，容易出现负载不均。",
	},
	{
		prompt: "为什么现在的大模型都转向 MoE 架构？",
		answer: "在同等计算预算下，MoE 能用更多参数换取更强容量，而每个 token 只激活一小部分专家。训练和推理的 FLOPs 可控，是参数扩展最划算的路径之一。",
	},
	{
		prompt: "对齐阶段 SFT 和 RLHF 的数据配比一般怎么定？",
		answer: "没有通用比例。通常先用足量高质量 SFT 教会格式与基础能力，再用偏好数据做 RLHF/DPO 修正风格与安全性；数据质量比数量更关键，且要持续评估回退。",
	},
	{
		prompt: "DPO 相比 PPO 的优势和局限分别是什么？",
		answer: "DPO 直接用偏好对优化策略，省掉奖励模型和在线采样，训练稳定、成本低。局限是依赖离线偏好数据，探索能力弱，分布偏移时容易过拟合。",
	},
	{
		prompt: "评测一个模型的长上下文能力，应该看哪些指标？",
		answer: "除了「NIAH 大海捞针」，还要看多跳检索、长文档问答、跨段推理和位置敏感性。指标应覆盖准确率、延迟、显存，以及不同长度区间的退化曲线。",
	},
	{
		prompt: "如何设计一个能区分「真理解」和「模式匹配」的评测？",
		answer: "用反事实改写、扰动顺序、替换实体、要求引用原文位置，并加入需要多步推理才能回答的问题。只靠表面关键词匹配的模型会在这些变体上明显掉分。",
	},
	{
		prompt: "位置插值和 RoPE 外推有什么区别？",
		answer: "位置插值把超长位置压缩回训练范围，需要少量微调；RoPE 外推（如 NTK、YaRN）改旋转频率，让模型在未见长度上保持相对位置关系。前者稳，后者更省训练。",
	},
	{
		prompt: "为什么长上下文模型会出现「中间遗忘」？",
		answer: "注意力在长序列上容易被首尾吸引，中间位置的有效信号被稀释；训练数据里中间段的关键信息也较少。检索增强和分段摘要可以缓解。",
	},
	{
		prompt: "检索增强（RAG）能替代长上下文吗？",
		answer: "不能完全替代。RAG 擅长从大规模外部知识里定位证据，长上下文擅长在一次推理中整合全文；两者结合通常比单独使用更稳。",
	},
	{
		prompt: "多模态模型的注意力结构和文本模型有什么不同？",
		answer: "视觉 token 通常先经投影层对齐到文本空间，再与文本 token 拼接做联合注意力。关键差异在模态编码器、位置编码和训练时的模态配比。",
	},
	{
		prompt: "语音模型里的流式注意力怎么处理延迟？",
		answer: "用分块因果注意力，只保留最近一段上下文和压缩后的历史状态；配合 chunk 级 KV Cache 与前瞻，把首包延迟压到几百毫秒。",
	},
	{
		prompt: "端侧推理最值得做的三项优化是什么？",
		answer: "权重量化（INT4/INT8）、KV Cache 量化和算子融合；再叠加投机解码与动态批处理。优先保证内存带宽和功耗，而不是单纯追 FLOPs。",
	},
	{
		prompt: "量化会怎样影响注意力的数值稳定性？",
		answer: "量化误差会放大 softmax 的输入偏差，尤其在长序列上累积。常用做法是对 Q/K 保留更高精度、对 V 用低精度，或用 per-channel 缩放和异常值保护。",
	},
	{
		prompt: "为什么 INT4 权重需要分组量化？",
		answer: "权重分布存在通道级异常值，整层统一缩放会损失精度。按 group（如 64/128）分别计算 scale 和 zero-point，能把误差限制在局部，兼顾压缩率与效果。",
	},
	{
		prompt: "推理框架里 continuous batching 解决了什么问题？",
		answer: "传统静态 batch 要等最长序列结束，GPU 大量空转。continuous batching 在每个 decode step 动态加入/移除请求，显著提高吞吐并降低平均延迟。",
	},
	{
		prompt: "如何评估一次推理优化的真实收益？",
		answer: "固定模型、输入长度分布和并发度，测 TTFT、TPOT、吞吐和显存峰值；同时看 P99 延迟与质量回归。只报单条最快速度没有意义。",
	},
	{
		prompt: "如果只能读三篇论文，你推荐哪三篇？",
		answer: "Attention Is All You Need、FlashAttention、Efficient Memory Management for LLM Serving（PagedAttention）。三篇分别覆盖结构、算子效率和 serving 系统。",
	},
	{
		prompt: "帮我按主题给这次讨论整理一份提纲。",
		answer: "一、注意力基础；二、位置编码与长上下文；三、KV Cache 与推理优化；四、并行训练与 MoE；五、对齐与评测；六、工程实践。每部分保留三到五个关键结论。",
	},
	{
		prompt: "把提纲压缩成一张 A4 的复习卡片。",
		answer: "核心公式 → 缩放点积注意力；三条主线 → 显存（KV Cache/量化）、速度（FlashAttention/投机解码）、容量（MoE/长上下文）；两条评测原则 → 变体测试与端到端指标。",
	},
	{
		prompt: "最后用一句话总结整场讨论。",
		answer: "注意力是骨架，KV Cache 与并行决定它跑得多快，数据与评测决定它跑得多好——三者要一起优化。",
	},
];
