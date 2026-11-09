/* English counterpart of the 36-turn attention demo.
 *
 * Turns 7–13 and 17/19 deliberately answer in two or three sentences instead
 * of one: the README material tiles photograph transcript text *through* the
 * glass, and a wall of one-line answers leaves a white band above and below a
 * 102px preview card, which read as "no glass at all". Longer answers there
 * wrap to three or four lines and fill the card edge to edge. */
export const TITLE = "Attention and long-context inference";
export const TURNS = [
	{ prompt: "Explain Transformer attention from the basics.", answer: "Attention matches queries to keys, then weights the values. Scaled dot-product attention normalizes QKᵀ before multiplying by V." },
	{ prompt: "Write the scaled dot-product attention formula.", answer: "Attention(Q,K,V) = softmax(QKᵀ/√d_k)V. Queries match keys; normalized scores weight the values." },
	{ prompt: "Why divide by the square root of d_k?", answer: "Dot products grow with dimension. Scaling keeps softmax from saturating and helps gradients flow." },
	{ prompt: "What does multi-head attention solve?", answer: "Different heads learn different relationships in parallel, from local patterns to long-range dependencies." },
	{ prompt: "Why use RoPE instead of sinusoidal positions?", answer: "RoPE rotates queries and keys by position, encoding relative offsets. ALiBi is another approach based on additive biases." },
	{ prompt: "How does a causal mask work?", answer: "Before softmax, future positions get negative infinity, so each token can attend only to itself and earlier tokens." },
	{ prompt: "What does the KV cache store?", answer: "It stores the previous keys and values at every layer. A new token computes only its own q, k and v, then attends over the cached history instead of recomputing the whole prefix, which drops each step from O(n²) to O(n)." },
	{ prompt: "How do I estimate KV cache memory?", answer: "Roughly 2 × layers × KV heads × head size × sequence length × batch × bytes per element. A 7B model with 32 layers at 32k context spends over a dozen GB on a single sequence, which is why serving stacks obsess over this number." },
	{ prompt: "What are the main KV cache compression methods?", answer: "Quantization (INT8/INT4), token eviction such as H2O or StreamingLLM, low-rank compression like MLA, and cross-layer sharing. Quantization saves memory but costs accuracy, eviction is cheap but can drop the token that mattered, and MLA needs retraining." },
	{ prompt: "What is the idea behind PagedAttention?", answer: "PagedAttention cuts the KV cache into fixed-size blocks and maps them through a page table, the way an operating system manages virtual memory, so fragmentation disappears and prefixes can be shared. That is what let vLLM multiply serving throughput." },
	{ prompt: "Can speculative decoding use a KV cache?", answer: "Yes, and they compose. A draft model proposes a few tokens, the target model verifies them in one forward pass, accepted tokens are written straight into the cache, and rejected ones are rolled back. The two techniques are orthogonal, so latency drops noticeably when combined." },
	{ prompt: "How does FlashAttention use tiles?", answer: "FlashAttention tiles Q, K and V into blocks that fit in SRAM, walks the K/V blocks in the outer loop with Q blocks inside, and updates the softmax normalizer and output online, so the full attention matrix never has to be materialized in HBM." },
	{ prompt: "Why does FlashAttention save memory without reducing FLOPs?", answer: "It never writes the full intermediate matrix to HBM. The quadratic multiply-add count is unchanged, but the bytes moved collapse and tiling replaces them with recomputation, so the bottleneck moves from memory bandwidth to the math and wall-clock time still falls sharply." },
	{ prompt: "What are the main training parallelism strategies?", answer: "Data parallelism splits batches; tensor parallelism splits layers; pipeline parallelism splits stages; sequence parallelism splits tokens." },
	{ prompt: "How is attention split in tensor parallelism?", answer: "Devices handle subsets of attention heads and projections, then combine output projections with an all-reduce." },
	{ prompt: "How is mixture-of-experts routing trained?", answer: "A gate selects top-k experts per token. Load-balancing losses discourage collapse onto a few experts." },
	{ prompt: "What communication does expert parallelism require?", answer: "Tokens have to be routed to whichever device holds their expert and then sent back, typically with two all-to-all passes per layer. The more experts and the higher the parallelism, the larger that share of the step becomes, and unbalanced routing turns it into a straggler problem." },
	{ prompt: "Why are large models adopting MoE?", answer: "MoE increases parameter capacity while activating only a few experts per token, keeping per-token compute manageable." },
	{ prompt: "How should SFT and RLHF data be balanced?", answer: "There is no universal ratio. Start with enough high-quality supervised data to fix format and basic competence, then use preference pairs to correct style and safety, and keep evaluating for regressions — data quality dominates quantity at every stage." },
	{ prompt: "What are DPO's strengths and limits versus PPO?", answer: "DPO trains directly on preference pairs without online sampling, but relies on offline data and explores less." },
	{ prompt: "How should long-context models be evaluated?", answer: "Test retrieval, multi-hop reasoning, document QA, position sensitivity, latency, and memory across context lengths." },
	{ prompt: "How can evaluation distinguish reasoning from pattern matching?", answer: "Use counterfactuals, reordered evidence, new entities, citations, and questions requiring multiple reasoning steps." },
	{ prompt: "How does position interpolation differ from RoPE extrapolation?", answer: "Interpolation compresses positions into the training range; extrapolation changes frequencies to extend relative positions." },
	{ prompt: "Why do models lose information in the middle?", answer: "Signals in the middle can be diluted across long sequences. Retrieval and chunk summaries can help." },
	{ prompt: "Can RAG replace long context?", answer: "Not entirely. RAG retrieves external evidence; long context integrates more of it at once. They often work best together." },
	{ prompt: "How does multimodal attention differ from text attention?", answer: "Visual tokens are projected into a shared space and combined with text; encoders, positions, and training mixtures differ." },
	{ prompt: "How does streaming speech attention reduce latency?", answer: "Chunked causal attention retains recent context and compressed history, often with a small lookahead and a KV cache." },
	{ prompt: "What are three useful on-device inference optimizations?", answer: "Quantize weights, compress the KV cache, and fuse operators. Memory bandwidth and power are often the key constraints." },
	{ prompt: "How does quantization affect attention stability?", answer: "Quantization perturbs attention scores. Higher precision for Q and K, per-channel scaling, and outlier handling can help." },
	{ prompt: "Why use group quantization for INT4 weights?", answer: "Separate scales for small groups limit the effect of outliers and preserve more accuracy than a single layer-wide scale." },
	{ prompt: "What problem does continuous batching solve?", answer: "It adds and removes requests at each decode step, avoiding idle GPU time while waiting for the longest sequence." },
	{ prompt: "How should an inference optimization be measured?", answer: "Fix the workload and concurrency; measure TTFT, per-token latency, throughput, peak memory, tail latency, and quality." },
	{ prompt: "Which three papers should I read first?", answer: "Attention Is All You Need, FlashAttention, and the PagedAttention paper cover architecture, kernels, and serving." },
	{ prompt: "Organize this discussion into an outline.", answer: "Cover attention, positions, KV cache, inference, parallelism, MoE, alignment, evaluation, and engineering practice." },
	{ prompt: "Condense the outline into a one-page revision card.", answer: "Remember the attention formula and three themes: memory, speed, and capacity. Evaluate both quality and end-to-end performance." },
	{ prompt: "Summarize the discussion in one sentence.", answer: "Attention provides the structure; caches and parallelism determine speed, while data and evaluation determine quality." },
];
