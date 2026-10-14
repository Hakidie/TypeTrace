// Passages a typing session can use. A session keeps its own copy of the words, so editing a passage here never
// changes sessions that already exist. Words are separated by spaces; punctuation stays attached to its word.

export interface Passage {
  id: string;
  text: string;
}

export const passages: readonly Passage[] = [
  {
    id: 'basic-1',
    text: 'Tiếng Việt rất đẹp. Người trường quốc khuỷu nghiêng hoà thuỷ text, xong. Hôm nay trời đẹp, chúng ta cùng đi chơi nhé.'
  },
  {
    id: 'basic-2',
    text: 'Mỗi buổi sáng, em thức dậy thật sớm để chạy bộ quanh hồ. Không khí trong lành giúp em tỉnh táo hơn, rồi em về nhà ăn sáng cùng gia đình.'
  }
];

export const defaultPassageId = passages[0].id;

export const findPassage = (id: string) => passages.find((passage) => passage.id === id);
