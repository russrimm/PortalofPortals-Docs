const q = document.getElementById('q');
const chips = [...document.querySelectorAll('.chip')];
const cards = [...document.querySelectorAll('.card')];
const groups = [...document.querySelectorAll('.group')];
const count = document.getElementById('count');
const empty = document.getElementById('empty');
let cat = '';

function apply() {
  const term = q.value.trim().toLowerCase();
  let shown = 0;
  for (const card of cards) {
    const match = (!cat || card.dataset.category === cat) && (!term || card.dataset.search.includes(term));
    card.hidden = !match;
    if (match) shown++;
  }
  for (const group of groups) group.hidden = !group.querySelector('.card:not([hidden])');
  count.textContent = `${shown} of ${cards.length} pages`;
  empty.hidden = shown > 0;
}

q.addEventListener('input', apply);
for (const chip of chips) {
  chip.addEventListener('click', () => {
    cat = chip.dataset.cat;
    for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
    apply();
  });
}

const box = document.getElementById('lightbox');
const boxImg = box.querySelector('img');
for (const a of document.querySelectorAll('[data-full]')) {
  a.addEventListener('click', event => {
    if (!box.showModal) return;
    event.preventDefault();
    boxImg.src = a.href;
    boxImg.alt = a.querySelector('img').alt;
    box.showModal();
  });
}
box.addEventListener('click', event => { if (event.target === box || event.target === boxImg) box.close(); });
apply();
