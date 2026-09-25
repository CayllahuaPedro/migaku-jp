export interface DictSense {
  pos: string[];
  gloss: string[];
}

export interface DictEntry {
  id: string;
  kanji: string[];
  kana: string[];
  forms: string[];
  senses: DictSense[];
}

export type PitchMap = Record<string, number>;

export type PosTagMap = Record<string, string>;
