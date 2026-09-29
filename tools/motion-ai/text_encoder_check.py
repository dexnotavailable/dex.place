"""Check that Kimodo's text encoder (LLM2Vec on Llama 3 8B Instruct) loads correctly from our cache.

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/text_encoder_check.py [--device cpu|cuda]

Loads the encoder exactly the way kimodo_gen.py does (same D: cache, offline), then reproduces
the retrieval example from the McGill-NLP model card of
LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised, whose published cosine matrix is
    [[0.6470, 0.1619],
     [0.0786, 0.5844]]
A match (within bf16 noise, ~0.01) means the base weights, both LoRA adapters and the Llama 3
prompt template are all in effect. If an adapter silently failed to load, the numbers drift.
It also prints the prompt template LLM2Vec picked (it keys it on the base model's repo id).
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kimodo_gen  # noqa: E402

CARD = [[0.6470, 0.1619], [0.0786, 0.5844]]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    a = p.parse_args()

    import os

    hub = kimodo_gen.route_hf_env()
    kimodo_gen.check_text_encoder_cache(hub)
    os.environ["TEXT_ENCODER_DEVICE"] = a.device

    import torch
    from kimodo.model.load_model import TEXT_ENCODER_PRESETS
    from kimodo.model.llm2vec.llm2vec_wrapper import LLM2VecEncoder

    kw = dict(TEXT_ENCODER_PRESETS["llm2vec"]["kwargs"])
    t0 = time.perf_counter()
    enc = LLM2VecEncoder(**kw)
    t_load = time.perf_counter() - t0
    l2v = enc.model
    name = l2v.model.config._name_or_path
    template = l2v.prepare_for_tokenization("TEXT")

    instruction = "Given a web search query, retrieve relevant passages that answer the query:"
    queries = [[instruction, "how much protein should a female eat"], [instruction, "summit define"]]
    documents = [
        "As a general guideline, the CDC's average requirement of protein for women ages 19 to 70 is 46 grams per day. But, as you can see from this chart, you'll need to increase that if you're expecting or training for a marathon. Check out the chart below to see how much protein you should be eating each day.",
        "Definition of summit for English Language Learners. : 1  the highest point of a mountain : the top of a mountain. : 2  the highest level. : 3  a meeting or series of meetings between the leaders of two or more governments.",
    ]
    t1 = time.perf_counter()
    with torch.no_grad():
        q = torch.as_tensor(l2v.encode(queries, batch_size=1, show_progress_bar=False, device=enc._device)).float()
        d = torch.as_tensor(l2v.encode(documents, batch_size=1, show_progress_bar=False, device=enc._device)).float()
    t_enc = time.perf_counter() - t1
    cos = torch.nn.functional.normalize(q, dim=1) @ torch.nn.functional.normalize(d, dim=1).T
    got = [[round(float(x), 4) for x in row] for row in cos]
    err = max(abs(got[i][j] - CARD[i][j]) for i in range(2) for j in range(2))

    peft_layers = sum(1 for n, _ in l2v.model.named_modules() if n.endswith("lora_A"))
    report = {
        "device": enc._device,
        "base_name_or_path": name,
        "template": template,
        "lora_modules_active": peft_layers,
        "cos_sim": got,
        "model_card": CARD,
        "max_abs_err": round(err, 4),
        "ok": err < 0.02,
        "seconds_load": round(t_load, 1),
        "seconds_encode_4_texts": round(t_enc, 1),
    }
    print("TEXT_ENCODER_CHECK " + json.dumps(report))
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
