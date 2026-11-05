// End-of-mission quiz: three questions about facts the player actually met in their logbook.
// Every question is tied to a fact id in data/mars-facts.json, so the answer is always sourced.
export const QUESTIONS = [
  { fact: 'sol', q: 'How long is one day (a "sol") on Mars?', a: ['24 hours 40 minutes', '12 hours', '3 Earth days'] },
  { fact: 'gravity', q: 'Mars gravity is about how strong compared with Earth?', a: ['38% (you jump higher)', 'Exactly the same', '3 times stronger'] },
  { fact: 'delay', q: 'How long does a radio message take between Mars and Earth?', a: ['3 to 22 minutes', 'Less than a second', 'About a week'] },
  { fact: 'blueSunset', q: 'What colour is a sunset on Mars?', a: ['Blue', 'Green', 'Purple'] },
  { fact: 'careerLimit', q: 'What is the most space radiation NASA allows in an astronaut\'s career?', a: ['600 mSv', '6 mSv', '60,000 mSv'] },
  { fact: 'dustPanels', q: 'What slowly stops solar panels working on Mars?', a: ['Dust settling on them', 'Rain', 'Snow'] },
  { fact: 'conjunction', q: 'About every 26 months, what blocks radio between Earth and Mars?', a: ['The Sun', 'The Moon', 'Jupiter'] },
  { fact: 'regolith', q: 'Why would astronauts pile regolith (Mars soil) on their outpost?', a: ['To block radiation', 'To keep it warm', 'To hide it'] },
  { fact: 'sls', q: 'What is the name of NASA\'s giant Moon rocket?', a: ['SLS (Space Launch System)', 'Saturn VI', 'Star Hopper'] },
  { fact: 'hls', q: 'Why do Artemis astronauts change into an HLS lander near the Moon?', a: ['Orion cannot land on the Moon', 'Orion is too slow', 'Orion has no seats'] },
  { fact: 'launchWindow', q: 'Why can missions only leave for Mars about every 26 months?', a: ['Mars must be in the right place when they arrive', 'Rockets need 26 months of repairs', 'Mars is closed the rest of the time'] },
  { fact: 'edl', q: 'What protects a lander from the heat when it hits Mars\'s air?', a: ['The heat shield', 'The parachute', 'The solar panels'] },
  { fact: 'oxygen', q: 'About how much oxygen does one astronaut breathe each day?', a: ['0.82 kg', '82 kg', 'None - Mars air is fine'] },
  { fact: 'moxie', q: 'What did MOXIE on Perseverance make out of Mars air?', a: ['Oxygen', 'Water', 'Gold'] },
  { fact: 'ascent', q: 'What happens to SLS\'s two white boosters about 2 minutes after lift-off?', a: ['They drop off into the ocean', 'They fly to the Moon', 'They turn into solar panels'] },
  { fact: 'fission', q: 'Why is a fission reactor useful on Mars?', a: ['It makes power at night and in dust storms', 'It makes the air breathable', 'It makes Mars warmer'] },
  { fact: 'cruiseDose', q: 'Where is space radiation worse for astronauts?', a: ['Travelling between planets', 'On the surface of Mars', 'Inside a buried outpost'] },
];

const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

// Pick 3 questions, preferring facts in the player's logbook.
export function pickQuestions(seenIds, n = 3) {
  const seen = shuffle(QUESTIONS.filter(q => seenIds.has(q.fact)));
  const rest = shuffle(QUESTIONS.filter(q => !seenIds.has(q.fact)));
  return [...seen, ...rest].slice(0, n);
}

// Draws the quiz into `box`; calls onDone(score) when every question is answered.
export function runQuiz(box, questions, onDone) {
  let answered = 0, score = 0;
  box.innerHTML = questions.map((q, i) => `
    <div class="quiz-q" data-i="${i}"><p>${i + 1}. ${q.q}</p>
      <div class="opts">${shuffle(q.a.map((t, k) => ({ t, right: k === 0 }))).map(o => `<button data-right="${o.right}">${o.t}</button>`).join('')}</div>
    </div>`).join('');
  box.querySelectorAll('.quiz-q').forEach(div => {
    const btns = [...div.querySelectorAll('button')];
    btns.forEach(b => b.onclick = () => {
      const right = b.dataset.right === 'true';
      btns.forEach(x => { x.disabled = true; if (x.dataset.right === 'true') x.classList.add('right'); });
      if (!right) b.classList.add('wrong'); else score++;
      if (++answered === questions.length) onDone(score);
    });
  });
}

export function badgeFor(score, n) {
  if (score === n) return { icon: '🥇', name: 'Gold Junior Astronaut' };
  if (score >= n - 1) return { icon: '🥈', name: 'Silver Junior Astronaut' };
  return { icon: '🥉', name: 'Bronze Junior Astronaut' };
}
