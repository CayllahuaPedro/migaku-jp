import kuromoji from 'kuromoji';

export interface JpToken {
  surface: string;
  reading?: string;
  basicForm: string;
  pos: string;
}

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let tokenizerPromise: Promise<Tokenizer> | null = null;

export function initTokenizer(dicPath: string): Promise<void> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          tokenizerPromise = null;
          reject(err);
        } else {
          resolve(tokenizer);
        }
      });
    });
  }
  return tokenizerPromise.then(() => undefined);
}

export async function tokenize(text: string): Promise<JpToken[]> {
  if (!tokenizerPromise) throw new Error('tokenizer not initialized');
  const tokenizer = await tokenizerPromise;
  return tokenizer.tokenize(text).map((tk) => ({
    surface: tk.surface_form,
    reading: tk.reading === '*' || tk.reading === undefined ? undefined : tk.reading,
    basicForm: tk.basic_form === '*' ? tk.surface_form : tk.basic_form,
    pos: tk.pos,
  }));
}
