import { RawBranchItem, RawDustItem, RawRepoDataset, RawSpineItem } from '../types/graph';

const REPO_URL = 'https://github.com/ggml-org/llama.cpp';

function buildArchitectureSpine(): RawSpineItem[] {
  const milestones: Array<{
    id: string;
    label: string;
    ref: string;
    category: string;
    description: string;
    featured?: boolean;
    labelSide?: 'left' | 'right';
  }> = [
    {
      id: 'arch-s-0',
      label: 'llama_decode',
      ref: 'src/llama-context.cpp',
      category: 'Inference Entry',
      description: 'Top-level autoregressive token decoding and KV-cache batch scheduling entry point.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-8',
      label: 'llama_server_worker',
      ref: 'tools/server/server.cpp',
      category: 'Serving Runtime',
      description: 'Continuous batching slot scheduler, OpenAI-compatible HTTP endpoints, and SSE streaming.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-16',
      label: 'llama_graph_build',
      ref: 'src/llama-graph.cpp',
      category: 'Graph Construction',
      description: 'Constructs symbolic transformer compute DAG across attention, RoPE, and FFN layers.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-24',
      label: 'llm_build_llama',
      ref: 'src/models/llama.cpp',
      category: 'Model Architecture',
      description: 'Wires RMSNorm, QKV projections, rotary embeddings, and SwiGLU residual blocks.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-32',
      label: 'llama_kv_cache_update',
      ref: 'src/llama-kv-cache.cpp',
      category: 'Memory & Cache',
      description: 'Manages paged key-value ring buffers, sequence shifts, and defragmentation.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-40',
      label: 'flash_attn_ext',
      ref: 'ggml/src/ggml.c',
      category: 'Attention Kernel',
      description: 'Fused multi-head and grouped-query flash attention operator with ALiBi & softcap.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-48',
      label: 'ggml_backend_sched_graph_compute',
      ref: 'ggml/src/ggml-backend.cpp',
      category: 'Backend Scheduler',
      description: 'Partitions compute graph across GPU layers, host CPU fallback, and zero-copy splits.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-58',
      label: 'ggml_cuda_op_mul_mat',
      ref: 'ggml/src/ggml-cuda/mmq.cu',
      category: 'Tensor Kernel',
      description: 'Quantized matrix-vector and MMQ warp-level tensor core multiplication kernel.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-68',
      label: 'ggml_compute_forward',
      ref: 'ggml/src/ggml-cpu/ggml-cpu.c',
      category: 'CPU Execution',
      description: 'Thread-pool barrier dispatch across AVX-512, AMX, and ARM NEON dot-product kernels.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-78',
      label: 'llama_model_load',
      ref: 'src/llama-model-loader.cpp',
      category: 'Model Loader',
      description: 'Memory-maps tensor weights and validates architecture hyperparameters from GGUF.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-88',
      label: 'gguf_init_from_file',
      ref: 'ggml/src/gguf.cpp',
      category: 'Serialization',
      description: 'Binary GGUF v3 header parser, metadata KV reader, and 32-byte aligned tensor offsets.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-98',
      label: 'llama_sampler_chain_apply',
      ref: 'src/llama-sampling.cpp',
      category: 'Sampling Pipeline',
      description: 'Applies grammar constraints, min-p, top-k, mirostat, and temperature logit transforms.',
      featured: true,
      labelSide: 'right',
    },
    {
      id: 'arch-s-108',
      label: 'llama_tokenize_internal',
      ref: 'src/llama-vocab.cpp',
      category: 'Tokenization',
      description: 'Byte-pair encoding (BPE), SentencePiece unigram, and special control token matcher.',
      featured: true,
      labelSide: 'left',
    },
    {
      id: 'arch-s-119',
      label: 'ggml_init',
      ref: 'ggml/src/ggml.c',
      category: 'Tensor Primitives',
      description: 'Foundational arena allocator, tensor descriptor structs, and FP16/BF16 lookup tables.',
      featured: true,
      labelSide: 'right',
    },
  ];

  const milestoneMap = new Map<number, (typeof milestones)[number]>();
  for (const m of milestones) {
    const idx = Number(m.id.replace('arch-s-', ''));
    milestoneMap.set(idx, m);
  }

  const spineNames = [
    'llama_decode_step',
    'llama_ubatch_split',
    'llama_batch_prepare',
    'llama_ctx_alloc_graph',
    'llama_output_reserve',
    'llama_logits_copy',
    'llama_embeddings_extract',
    'server_slot_process',
    'server_task_queue',
    'llm_graph_context_init',
    'llm_graph_input_tokens',
    'llm_graph_input_pos',
    'llm_graph_input_attn',
    'llm_build_inp_embd',
    'llm_build_norm',
    'llm_build_attn_mha',
    'llm_build_rope_freq',
    'llm_build_ffn_swiglu',
    'llm_build_moe_gate',
    'kv_cell_find_slot',
    'kv_cache_seq_cp',
    'kv_cache_defrag_impl',
    'ggml_flash_attn_f16',
    'ggml_rope_ext',
    'ggml_rms_norm',
    'ggml_mul_mat_id',
    'ggml_soft_max_ext',
    'ggml_backend_sched_split',
    'ggml_backend_sched_alloc',
    'ggml_backend_tensor_copy',
    'ggml_cuda_graph_exec',
    'ggml_cuda_mmvq_q4_k',
    'ggml_metal_encode_node',
    'ggml_vulkan_dispatch',
    'ggml_cpu_barrier',
    'ggml_vec_dot_q4_K_q8_K',
    'ggml_vec_dot_q8_0_q8_0',
    'ggml_vec_dot_iq4_nl',
    'ggml_threadpool_chunk',
    'llama_model_mmap',
    'llama_tensor_buft_select',
    'llama_hparams_read',
    'gguf_kv_get_val',
    'gguf_tensor_info_parse',
    'llama_sampler_top_k',
    'llama_sampler_min_p',
    'llama_sampler_xtc',
    'llama_grammar_accept',
    'llama_vocab_bpe_merge',
    'llama_vocab_spm_score',
    'ggml_new_tensor_4d',
    'ggml_type_traits_lookup',
  ];

  const items: RawSpineItem[] = [];
  for (let i = 0; i < 120; i++) {
    const m = milestoneMap.get(i);
    if (m) {
      items.push({
        ...m,
        url: `${REPO_URL}/blob/master/${m.ref}`,
      });
    } else {
      const name = spineNames[i % spineNames.length];
      const phase =
        i < 20
          ? 'Inference Entry'
          : i < 45
            ? 'Graph & Attention'
            : i < 72
              ? 'Backend Compute'
              : i < 95
                ? 'Loader & GGUF'
                : 'Sampling & Core';
      const ref =
        i < 20
          ? 'src/llama-context.cpp'
          : i < 45
            ? 'src/llama-graph.cpp'
            : i < 72
              ? 'ggml/src/ggml-backend.cpp'
              : i < 95
                ? 'src/llama-model-loader.cpp'
                : 'ggml/src/ggml.c';
      items.push({
        id: `arch-s-${i}`,
        label: `${name}_${i}`,
        ref,
        category: phase,
        description: `Execution spine stage #${i + 1} within ${phase.toLowerCase()} (${ref}).`,
        url: `${REPO_URL}/blob/master/${ref}`,
      });
    }
  }
  return items;
}

function buildArchitectureBranches(): RawBranchItem[] {
  const subsystems: Array<{
    category: string;
    side: 'left' | 'right';
    anchorRange: [number, number];
    nodes: Array<[string, string, string, boolean?]>;
  }> = [
    {
      category: 'CUDA Backend',
      side: 'right',
      anchorRange: [44, 70],
      nodes: [
        ['ggml-cuda.cu', 'ggml/src/ggml-cuda/ggml-cuda.cu', 'CUDA stream dispatch & tensor buffer management', true],
        ['mmvq.cu', 'ggml/src/ggml-cuda/mmvq.cu', 'Vectorized quant matrix-vector kernels for low batch sizes'],
        ['mmq.cu', 'ggml/src/ggml-cuda/mmq.cu', 'Tensor-core quantized matmul kernels (dp4a / mma)'],
        ['fattn-wmma-f16.cu', 'ggml/src/ggml-cuda/fattn-wmma-f16.cu', 'WMMA tensor-core FlashAttention-2 kernel', true],
        ['fattn-vec-f16.cu', 'ggml/src/ggml-cuda/fattn-vec-f16.cu', 'Vectorized single-token decode FlashAttention'],
        ['rope.cu', 'ggml/src/ggml-cuda/rope.cu', 'Rotary position embedding CUDA kernel'],
        ['norm.cu', 'ggml/src/ggml-cuda/norm.cu', 'Fused RMSNorm and LayerNorm CUDA kernels'],
        ['quantize.cu', 'ggml/src/ggml-cuda/quantize.cu', 'On-device Q8_1 activation quantization'],
        ['cpy.cu', 'ggml/src/ggml-cuda/cpy.cu', 'Async device-to-device tensor strided copy'],
        ['ssm-conv.cu', 'ggml/src/ggml-cuda/ssm-conv.cu', 'Mamba / SSM 1D causal convolution kernel'],
        ['top-k.cu', 'ggml/src/ggml-cuda/top-k.cu', 'GPU radix sort for MoE gating'],
        ['binbcast.cu', 'ggml/src/ggml-cuda/binbcast.cu', 'Broadcasted elementwise add/mul/div kernels'],
      ],
    },
    {
      category: 'Apple Metal Backend',
      side: 'left',
      anchorRange: [42, 72],
      nodes: [
        ['ggml-metal.m', 'ggml/src/ggml-metal/ggml-metal.m', 'Objective-C Metal command buffer & residency set manager', true],
        ['ggml-metal.metal', 'ggml/src/ggml-metal/ggml-metal.metal', 'Unified Apple Silicon SIMD-group shader kernels', true],
        ['metal_mul_mv_q4_K', 'ggml/src/ggml-metal/ggml-metal.metal', 'Apple Silicon SIMD-group Q4_K matrix-vector shader'],
        ['metal_flash_attn', 'ggml/src/ggml-metal/ggml-metal.metal', 'Tile-memory FlashAttention Metal kernel'],
        ['metal_rope_neox', 'ggml/src/ggml-metal/ggml-metal.metal', 'NeoX-style rotary embedding Metal compute shader'],
        ['metal_soft_max', 'ggml/src/ggml-metal/ggml-metal.metal', 'Warp-reduced Softmax Metal shader'],
        ['metal_cpy_f16', 'ggml/src/ggml-metal/ggml-metal.metal', 'Unified memory zero-copy format conversion'],
        ['metal_mul_mm_id', 'ggml/src/ggml-metal/ggml-metal.metal', 'MoE indirect expert matrix multiply kernel'],
      ],
    },
    {
      category: 'Vulkan & SYCL Backends',
      side: 'right',
      anchorRange: [46, 75],
      nodes: [
        ['ggml-vulkan.cpp', 'ggml/src/ggml-vulkan/ggml-vulkan.cpp', 'Cross-vendor Vulkan compute pipeline & SPIR-V compiler', true],
        ['mul_mat_vec.comp', 'ggml/src/ggml-vulkan/vulkan-shaders/mul_mat_vec.comp', 'GLSL compute shader for quantized matvec'],
        ['flash_attn.comp', 'ggml/src/ggml-vulkan/vulkan-shaders/flash_attn.comp', 'Cooperative-matrix Vulkan FlashAttention shader'],
        ['ggml-sycl.cpp', 'ggml/src/ggml-sycl/ggml-sycl.cpp', 'Intel oneAPI SYCL GPU & XPU backend', true],
        ['ggml-cann.cpp', 'ggml/src/ggml-cann/ggml-cann.cpp', 'Ascend NPU ACL graph execution backend'],
        ['ggml-rpc.cpp', 'ggml/src/ggml-rpc/ggml-rpc.cpp', 'Distributed tensor offload over TCP sockets', true],
      ],
    },
    {
      category: 'Quantization Kernels',
      side: 'left',
      anchorRange: [60, 92],
      nodes: [
        ['ggml-quants.c', 'ggml/src/ggml-quants.c', 'K-quants & I-quants block quantization/dequantization', true],
        ['quantize_q4_K', 'ggml/src/ggml-quants.c', '4.5 bpw super-block importance-weighted quantization'],
        ['quantize_iq4_nl', 'ggml/src/ggml-quants.c', 'Non-linear 4-bit k-means codebook quantization', true],
        ['quantize_iq2_xxs', 'ggml/src/ggml-quants.c', 'Extreme 2.06 bpw E8 lattice vector quantization'],
        ['quantize_q8_0', 'ggml/src/ggml-quants.c', '8-bit symmetric block quantization for KV cache'],
        ['llama-quant.cpp', 'src/llama-quant.cpp', 'Importance-matrix (imatrix) model quantization driver', true],
        ['ggml-cpu-aarch64.cpp', 'ggml/src/ggml-cpu/arch/arm/quants.c', 'ARMv9 i8mm / dotprod SIMD quant kernels'],
        ['ggml-cpu-x86.c', 'ggml/src/ggml-cpu/arch/x86/quants.c', 'AVX2 / AVX-512 VNNI integer dot-product kernels'],
      ],
    },
    {
      category: 'Model Architectures',
      side: 'right',
      anchorRange: [14, 38],
      nodes: [
        ['models/deepseek2.cpp', 'src/models/deepseek2.cpp', 'DeepSeek-V2/V3 Multi-Head Latent Attention & MoE', true],
        ['models/qwen2.cpp', 'src/models/qwen2.cpp', 'Qwen2 & Qwen2.5-MoE grouped-query attention graph'],
        ['models/gemma3.cpp', 'src/models/gemma3.cpp', 'Gemma 3 sliding-window + global hybrid attention', true],
        ['models/mamba.cpp', 'src/models/mamba.cpp', 'Selective state-space model recurrent scan graph'],
        ['models/llama4.cpp', 'src/models/llama4.cpp', 'Llama 4 iRoPE chunked attention & MoE routing'],
        ['models/mistral.cpp', 'src/models/mistral.cpp', 'Sliding window attention & YaRN context scaling'],
        ['models/phi3.cpp', 'src/models/phi3.cpp', 'LongRoPE su-scaled Phi-3 / Phi-4 architecture'],
        ['models/command-r.cpp', 'src/models/command-r.cpp', 'Cohere parallel attention + FFN block'],
        ['models/rwkv6.cpp', 'src/models/rwkv6.cpp', 'RWKV linear-time WKV recurrence graph'],
        ['models/whisper.cpp', 'src/models/whisper.cpp', 'Encoder-decoder cross-attention graph'],
      ],
    },
    {
      category: 'Serving, Grammar & Multimodal',
      side: 'left',
      anchorRange: [2, 26],
      nodes: [
        ['tools/server/httplib', 'tools/server/server.cpp', 'HTTP/1.1 persistent connections & /v1/chat/completions'],
        ['tools/mtmd/clip.cpp', 'tools/mtmd/clip.cpp', 'ViT / SigLIP multimodal vision projector', true],
        ['src/llama-grammar.cpp', 'src/llama-grammar.cpp', 'GBNF context-free grammar bitmask logit filter', true],
        ['src/llama-chat.cpp', 'src/llama-chat.cpp', 'Jinja / built-in chat template formatter'],
        ['common/speculative.cpp', 'common/speculative.cpp', 'Draft-model speculative token verification'],
        ['common/sampling.cpp', 'common/sampling.cpp', 'DRY, XTC, Top-nSigma & Mirostat v2 samplers'],
        ['common/json-schema-to-grammar', 'common/json-schema-to-grammar.cpp', 'Compiles JSON Schema directly into GBNF rules'],
        ['src/llama-adapter.cpp', 'src/llama-adapter.cpp', 'Runtime LoRA & control-vector weight patching'],
      ],
    },
  ];

  const branches: RawBranchItem[] = [];
  let counter = 0;

  for (const sub of subsystems) {
    const [startIdx, endIdx] = sub.anchorRange;
    sub.nodes.forEach((node, idx) => {
      const [label, ref, description, featured] = node;
      const ratio = sub.nodes.length > 1 ? idx / (sub.nodes.length - 1) : 0.5;
      const spineStep = Math.round(startIdx + ratio * (endIdx - startIdx));
      const targetStep = Math.max(0, spineStep - (3 + (idx % 6)));
      const branchId = `arch-b-${counter++}`;
      branches.push({
        id: branchId,
        label,
        category: sub.category,
        ref,
        fromSpineId: `arch-s-${spineStep}`,
        toSpineId: `arch-s-${targetStep}`,
        side: sub.side,
        depth: 0.36 + ((idx * 17) % 10) * 0.055,
        description,
        url: `${REPO_URL}/blob/master/${ref}`,
        featured: Boolean(featured),
      });

      // Add organic secondary sub-filaments off major nodes
      const subCount = featured ? 3 : 2;
      for (let s = 0; s < subCount; s++) {
        branches.push({
          id: `arch-b-${counter++}`,
          label: `${label.replace(/\.[^.]+$/, '')}::op_${s + 1}`,
          category: sub.category,
          ref,
          fromSpineId: `arch-s-${spineStep}`,
          parentBranchId: branchId,
          side: sub.side,
          depth: 0.55 + s * 0.14,
          description: `Helper routine / kernel specialization linked from ${label}.`,
          url: `${REPO_URL}/blob/master/${ref}`,
          featured: false,
        });
      }
    });
  }

  return branches;
}

function buildArchitectureDust(): RawDustItem[] {
  const unreachedFiles = [
    ['examples/batched/batched.cpp', 'Standalone batched decoding example'],
    ['examples/benchmark/benchmark-matmult.cpp', 'Micro-benchmark for matmul throughput'],
    ['examples/eval-callback/eval-callback.cpp', 'Tensor inspection callback sample'],
    ['examples/gritlm/gritlm.cpp', 'GritLM bidirectional embedding sample'],
    ['examples/infill/infill.cpp', 'Fill-in-the-middle code completion sample'],
    ['examples/lookahead/lookahead.cpp', 'Jacobi lookahead decoding experiment'],
    ['examples/lookup/lookup.cpp', 'N-gram prompt lookup decoding demo'],
    ['examples/parallel/parallel.cpp', 'Multi-sequence KV-cache sharing example'],
    ['examples/passkey/passkey.cpp', 'Long-context needle-in-haystack test'],
    ['examples/retrieval/retrieval.cpp', 'Vector retrieval CLI prototype'],
    ['examples/save-load-state/save-load-state.cpp', 'Session binary state serialization demo'],
    ['examples/simple/simple.cpp', 'Minimal 120-line inference tutorial'],
    ['examples/speculative-simple/speculative-simple.cpp', 'Minimal draft-model sampling demo'],
    ['tests/test-tokenizer-0.cpp', 'BPE & SPM vocabulary regression suite'],
    ['tests/test-grammar-parser.cpp', 'GBNF parser unit test suite'],
    ['tests/test-quantize-fns.cpp', 'Quantization roundtrip precision check'],
    ['tests/test-backend-ops.cpp', 'Cross-backend tensor operator parity test'],
    ['tests/test-rope.cpp', 'Rotary embedding numerical accuracy check'],
    ['convert_hf_to_gguf.py', 'Offline HuggingFace safetensors-to-GGUF converter'],
    ['convert_lora_to_gguf.py', 'Offline LoRA adapter GGUF exporter'],
    ['scripts/compare-llama-bench.py', 'Markdown table benchmark diff script'],
    ['scripts/sync-ggml.sh', 'Upstream ggml repository sync script'],
    ['pocs/vdot/vdot.cpp', 'Proof-of-concept integer dot-product study'],
    ['tools/imatrix/imatrix.cpp', 'Offline activation importance matrix collector'],
    ['tools/perplexity/perplexity.cpp', 'Dataset perplexity evaluation utility'],
    ['tools/gguf-split/gguf-split.cpp', 'Multi-shard GGUF file splitter utility'],
  ];

  const dust: RawDustItem[] = [];
  for (let i = 0; i < 240; i++) {
    const base = unreachedFiles[i % unreachedFiles.length];
    const suffix = i >= unreachedFiles.length ? `#${Math.floor(i / unreachedFiles.length)}` : '';
    dust.push({
      id: `arch-d-${i}`,
      label: `${base[0]}${suffix}`,
      category: base[0].startsWith('tests/')
        ? 'Test Suite'
        : base[0].startsWith('examples/')
          ? 'Example Binary'
          : 'Auxiliary Script',
      ref: base[0],
      description: `${base[1]} (not reached by core inference spine).`,
      url: `${REPO_URL}/blob/master/${base[0]}`,
    });
  }
  return dust;
}

function buildHistoryData(): RawRepoDataset['history'] {
  const eraMilestones: Array<{
    idx: number;
    label: string;
    ref: string;
    author: string;
    timestamp: string;
    description: string;
    side: 'left' | 'right';
  }> = [
    {
      idx: 0,
      label: 'HEAD: multimodal & MCP tools',
      ref: 'b84e19c',
      author: 'ggerganov',
      timestamp: '2026-11-18',
      description: 'Unified tools/mtmd multimodal projection and llama-server continuous batching upgrades.',
      side: 'left',
    },
    {
      idx: 12,
      label: 'feat: Llama 4 & iRoPE MoE',
      ref: '9a31f04',
      author: 'slaren',
      timestamp: '2025-04-06',
      description: 'Added chunked attention, iRoPE scaling, and MoE routing for Llama 4.',
      side: 'right',
    },
    {
      idx: 24,
      label: 'ggml: unified backend scheduler',
      ref: '7d12c88',
      author: 'slaren',
      timestamp: '2024-12-14',
      description: 'Split ggml-cpu, ggml-cuda, and ggml-metal into modular backend targets.',
      side: 'left',
    },
    {
      idx: 36,
      label: 'cuda: FlashAttention-2 WMMA',
      ref: '5c09e21',
      author: 'JohannesGaessler',
      timestamp: '2024-05-09',
      description: 'Fused FP16 & quantized KV-cache FlashAttention kernels for long contexts.',
      side: 'right',
    },
    {
      idx: 48,
      label: 'ggml: Vulkan compute backend',
      ref: '4b82a10',
      author: '0cc4m',
      timestamp: '2024-02-11',
      description: 'Cross-vendor GPU inference via SPIR-V compute shaders.',
      side: 'left',
    },
    {
      idx: 60,
      label: 'quants: I-quants (IQ4_NL / IQ2)',
      ref: '3e71d44',
      author: 'ikawrakow',
      timestamp: '2024-01-19',
      description: 'Sub-4-bit importance-weighted vector quantization with minimal perplexity loss.',
      side: 'right',
    },
    {
      idx: 74,
      label: 'gguf: replace GGML format',
      ref: '28f91b3',
      author: 'ggerganov',
      timestamp: '2023-08-21',
      description: 'Introduced extensible GGUF v1/v3 binary model format with aligned KV metadata.',
      side: 'left',
    },
    {
      idx: 88,
      label: 'metal: Apple Silicon unified GPU',
      ref: '1a64c02',
      author: 'ggerganov',
      timestamp: '2023-06-05',
      description: 'Zero-copy Metal shader pipeline unlocking full GPU acceleration on M1/M2/M3.',
      side: 'right',
    },
    {
      idx: 102,
      label: 'cublas: initial CUDA offload',
      ref: '0f52e77',
      author: 'slaren',
      timestamp: '2023-05-02',
      description: 'First NVIDIA CUDA matrix multiplication and layer-offload kernels.',
      side: 'left',
    },
    {
      idx: 119,
      label: 'init: LLaMA 7B in pure C/C++',
      ref: '078c8b6',
      author: 'ggerganov',
      timestamp: '2023-03-10',
      description: 'Initial commit: 4-bit LLaMA inference running locally on MacBook M1 CPU.',
      side: 'right',
    },
  ];

  const milestoneByIdx = new Map(eraMilestones.map((m) => [m.idx, m]));
  const spine: RawSpineItem[] = [];
  for (let i = 0; i < 120; i++) {
    const m = milestoneByIdx.get(i);
    if (m) {
      spine.push({
        id: `hist-s-${i}`,
        label: m.label,
        ref: m.ref,
        category: 'Master Spine',
        author: m.author,
        timestamp: m.timestamp,
        description: m.description,
        url: `${REPO_URL}/commits/master`,
        featured: true,
        labelSide: m.side,
      });
    } else {
      const year = i < 20 ? '2026' : i < 55 ? '2025' : i < 90 ? '2024' : '2023';
      spine.push({
        id: `hist-s-${i}`,
        label: `merge: master#${6800 - i * 48}`,
        ref: (0xa100000 + i * 7919).toString(16),
        category: 'First-Parent Commit',
        author: i % 3 === 0 ? 'ggerganov' : i % 3 === 1 ? 'slaren' : 'ngxson',
        timestamp: `${year}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 3) % 27)).padStart(2, '0')}`,
        description: `First-parent integration commit along master history (#${6800 - i * 48}).`,
        url: `${REPO_URL}/commits/master`,
      });
    }
  }

  const prTopics = [
    ['pr/cuda-mmq-warp', 'CUDA MMQ Warp Tiling', 'JohannesGaessler', 36, 'right', true],
    ['pr/metal-simd-f16', 'Metal SIMD-Group FP16', 'ggerganov', 84, 'left', true],
    ['pr/k-quants-suite', 'K-Quants Suite (Q4_K_M)', 'ikawrakow', 70, 'right', true],
    ['pr/server-slots', 'Continuous Batching Server', 'ngxson', 20, 'left', true],
    ['pr/gbnf-grammar', 'GBNF Constrained Sampling', 'ejones', 64, 'left', true],
    ['pr/deepseek-mla', 'DeepSeek MLA KV Compression', 'slaren', 14, 'right', true],
    ['pr/vulkan-coopmat', 'Vulkan Cooperative Matrices', '0cc4m', 44, 'left', true],
    ['pr/speculative-draft', 'Speculative Draft Decoding', 'ggerganov', 52, 'right', false],
    ['pr/sycl-oneapi', 'Intel SYCL OneAPI Backend', 'yao-matrix', 40, 'right', false],
    ['pr/rpc-distributed', 'Distributed RPC Offloading', 'ggerganov', 28, 'left', false],
    ['pr/gguf-v3-endian', 'GGUF v3 Cross-Endian Support', 'cmp-nct', 72, 'left', false],
    ['pr/qwen2-moe', 'Qwen2.5-MoE & Vision Support', 'ngxson', 18, 'right', false],
    ['pr/bpe-pretokenizer', 'Tiktoken / Llama-3 BPE Regex', 'ggerganov', 50, 'left', false],
    ['pr/rope-yarn', 'YaRN Context Window Scaling', 'jquesnelle', 68, 'right', false],
    ['pr/arm-i8mm-sve', 'ARMv9 SVE & i8mm Acceleration', 'adenisov', 32, 'left', false],
  ] as const;

  const branches: RawBranchItem[] = [];
  let bIdx = 0;
  for (const [ref, label, author, anchor, side, featured] of prTopics) {
    const mainId = `hist-b-${bIdx++}`;
    branches.push({
      id: mainId,
      label,
      category: 'Merged Feature PR',
      ref,
      fromSpineId: `hist-s-${Math.min(118, anchor + 5)}`,
      toSpineId: `hist-s-${Math.max(1, anchor - 3)}`,
      side,
      depth: featured ? 0.58 : 0.42,
      author,
      description: `Feature branch ${ref} authored by @${author}, merged into master.`,
      url: `${REPO_URL}/pulls`,
      featured,
    });

    // Sub-commits inside each PR
    for (let k = 0; k < (featured ? 4 : 3); k++) {
      branches.push({
        id: `hist-b-${bIdx++}`,
        label: `${ref} (${k + 1}/${featured ? 4 : 3})`,
        category: 'Feature Commit',
        ref: `${ref}@${k + 1}`,
        fromSpineId: `hist-s-${Math.min(118, anchor + 5 - k)}`,
        parentBranchId: mainId,
        side,
        depth: 0.65 + k * 0.1,
        author,
        description: `Intermediate commit in ${label} branch.`,
        url: `${REPO_URL}/commits/master`,
      });
    }
  }

  const dust: RawDustItem[] = [];
  const staleNames = [
    'stale/opencl-clblast-v1',
    'stale/mmap-win32-draft',
    'abandoned/ggml-v1-compat',
    'experiment/4bit-hadamard',
    'wip/metal-bf16-test',
    'pruned/convert-pth-legacy',
    'revert/avx2-prefetch-tuning',
    'stale/rocm-hipblas-v0',
  ];
  for (let i = 0; i < 200; i++) {
    const base = staleNames[i % staleNames.length];
    dust.push({
      id: `hist-d-${i}`,
      label: `${base}-${i}`,
      category: 'Unmerged / Pruned Branch',
      ref: `${base}-${i}`,
      description: 'Stale experiment, closed PR, or pruned feature branch never merged into master.',
      url: `${REPO_URL}/branches`,
    });
  }

  return {
    spineTitle: '120-commit first-parent master spine',
    branchTitle: 'Sample of merged feature PRs & backend branches',
    dustTitle: 'Stale branches, closed PRs & pruned files',
    totalCommits: 6842,
    spine,
    branches,
    dust,
  };
}

export const LLAMA_CPP_BASELINE: RawRepoDataset = {
  owner: 'ggml-org',
  repo: 'llama.cpp',
  description: 'LLM inference in C/C++ with GGUF models and multi-backend tensor compute.',
  defaultBranch: 'master',
  stars: 76500,
  sourceKind: 'baseline',
  fetchedAt: '2026-11-24T00:00:00Z',
  architecture: {
    spineTitle: '120-step core inference & GGML spine',
    branchTitle: 'Sample of backends, quant kernels & model graphs',
    dustTitle: 'Standalone examples, tests & offline scripts never reached',
    totalFiles: 1420,
    spine: buildArchitectureSpine(),
    branches: buildArchitectureBranches(),
    dust: buildArchitectureDust(),
  },
  history: buildHistoryData(),
};
