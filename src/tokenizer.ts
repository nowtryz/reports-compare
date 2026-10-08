import { Tokenizer } from "@huggingface/tokenizers";
import { useEffect, useState } from "react";

const HUB = "https://huggingface.co";

/** One load per model for the page's lifetime, shared by every diff. */
const cache = new Map<string, Promise<Tokenizer>>();

async function fetchJson(modelId: string, file: string): Promise<unknown> {
  const res = await fetch(`${HUB}/${modelId}/resolve/main/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

export function loadTokenizer(modelId: string): Promise<Tokenizer> {
  let promise = cache.get(modelId);
  if (!promise) {
    promise = Promise.all([
      fetchJson(modelId, "tokenizer.json"),
      fetchJson(modelId, "tokenizer_config.json"),
    ]).then(([json, config]) => new Tokenizer(json as never, config as never));
    cache.set(modelId, promise);
  }
  return promise;
}

export type TokenizerState =
  | { status: "none" }
  | { status: "loading"; modelId: string }
  | { status: "ready"; modelId: string; tokenizer: Tokenizer }
  | { status: "error"; modelId: string; error: string };

/** Loads the tokenizer of `modelId` from the Hugging Face Hub; `undefined` loads nothing. */
export function useTokenizer(modelId: string | undefined): TokenizerState {
  const [state, setState] = useState<TokenizerState>({ status: "none" });
  useEffect(() => {
    if (!modelId) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", modelId });
    loadTokenizer(modelId).then(
      (tokenizer) => !cancelled && setState({ status: "ready", modelId, tokenizer }),
      (e) => !cancelled && setState({ status: "error", modelId, error: String(e?.message ?? e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [modelId]);
  return state;
}

/**
 * Splits `text` into the substrings covered by each of its tokens, so that they concatenate back
 * to `text`. Each piece is what decoding one more token adds to the decoded prefix, which keeps the
 * leading spaces that decoding a lone token would strip. A token ending inside a multi-byte
 * character is merged into the next one. `null` when the tokenizer does not round-trip the text
 * (normalizers that lowercase, strip accents, ...).
 */
export function tokenPieces(tokenizer: Tokenizer, text: string): string[] | null {
  const ids = tokenizer.encode(text, { add_special_tokens: false }).ids;
  const pieces: string[] = [];
  let prefix = "";
  for (let i = 1; i <= ids.length; i++) {
    const decoded = tokenizer.decode(ids.slice(0, i), {
      skip_special_tokens: true,
      clean_up_tokenization_spaces: false,
    });
    if (decoded.endsWith("�") && i < ids.length) continue;
    if (!decoded.startsWith(prefix)) return null;
    pieces.push(decoded.slice(prefix.length));
    prefix = decoded;
  }
  return prefix === text ? pieces : null;
}
