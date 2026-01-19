document.querySelectorAll('.card').forEach(card => {
    const body = card.querySelector('.card-body');

    card.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
            const act = btn.dataset.action;
            if (act === 'clear') body.innerHTML = '';
            if (act === 'text') body.append("Texto em " + new Date().toLocaleTimeString());
            if (act === 'slide') body.appendChild(new SlideWidget().el);
            if (act === 'int') body.appendChild(new IntWidget().el);
            if (act === 'string') body.appendChild(new StringWidget().el);
            if (act === 'check') body.appendChild(new CheckWidget().el);
        };
    });
});

class Card {
    constructor(id) {
        this.id = id;
    }
}
