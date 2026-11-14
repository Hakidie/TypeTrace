import { PassageView } from '@/modules/typing/components/PassageView';
import { checkWords, toWords } from '@/modules/typing/utils/typing-session';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';

const PASSAGE = 'Mỗi lỗi gõ sai đều để lại một dấu vết nhỏ trên đường học gõ nhanh hơn.';
const WORDS = toWords(PASSAGE);
// Three words typed right, one finished wrong (red, wavy underline) and one being typed (the caret): what the typing page shows.
const TYPED = ['Mỗi', 'lỗi', 'gõ', 'sau'];
const CURRENT = 'đề';

/** The sample passage of the Typing tab (a panel titled Preview), drawn by the typing page's own `PassageView` at the font size being chosen. */
export const TypingPreview = ({ fontSizeRem }: { fontSizeRem: number }) => (
  <Panel title="Preview" bare titleClassName={sectionTitleClass} className="pt-3">
    <span className="sr-only">{PASSAGE}</span>
    <div aria-hidden="true">
      <PassageView words={WORDS} results={checkWords(WORDS, TYPED)} current={CURRENT} fontSizeRem={fontSizeRem} />
    </div>
  </Panel>
);
