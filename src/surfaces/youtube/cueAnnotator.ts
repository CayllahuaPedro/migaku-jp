import type { RenderToken } from '../../core/annotate';

export interface LineTokens {
  get(text: string): RenderToken[] | null;
  onChange(cb: () => void): () => void;
}

export interface CueAnnotatorDeps {
  ready(): Promise<boolean>;
  analyze(text: string): Promise<RenderToken[]>;
}

export class CueAnnotator implements LineTokens {
  private readonly cache = new Map<string, RenderToken[]>();
  private readonly seen = new Set<string>();
  private readonly queue: string[] = [];
  private readonly listeners = new Set<() => void>();
  private running = false;
  private disposed = false;
  private warned = false;

  constructor(private readonly deps: CueAnnotatorDeps) {}

  prepare(texts: string[]): void {
    for (const text of texts) {
      if (this.seen.has(text)) continue;
      this.seen.add(text);
      this.queue.push(text);
    }
    void this.run();
  }

  get(text: string): RenderToken[] | null {
    const hit = this.cache.get(text);
    if (hit) return hit;
    const index = this.queue.indexOf(text);
    if (index > 0) {
      this.queue.splice(index, 1);
      this.queue.unshift(text);
    }
    return null;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    this.cache.clear();
    this.listeners.clear();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.deps.ready())) return;
      while (!this.disposed) {
        const text = this.queue.shift();
        if (text === undefined) return;
        await this.annotateOne(text);
      }
    } catch (error) {
      this.warnOnce(error);
    } finally {
      this.running = false;
    }
  }

  private async annotateOne(text: string): Promise<void> {
    try {
      const tokens = await this.deps.analyze(text);
      if (this.disposed) return;
      this.cache.set(text, tokens);
      for (const cb of [...this.listeners]) cb();
    } catch (error) {
      this.warnOnce(error);
    }
  }

  private warnOnce(error: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[yabai-jp] subtitle annotation failed', error);
  }
}

export function createEngineReady(
  ensureImported: () => Promise<void>,
  initTokenizer: () => Promise<void>,
): () => Promise<boolean> {
  let attempt: Promise<boolean> | null = null;
  return () => {
    attempt ??= (async () => {
      try {
        await ensureImported();
        await initTokenizer();
        return true;
      } catch (error) {
        console.warn('[yabai-jp] engine unavailable, subtitles stay plain', error);
        return false;
      }
    })();
    return attempt;
  };
}
