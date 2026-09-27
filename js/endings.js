const ENDINGS = {
    CONSUMED: { id: 'consumed', title: 'Я тебя запомнил', subtitle: 'До следующего раза...', weight: 'bad',
        condition: s => s.threat >= 90 || s.faceLost >= 4 },
    AFRAID: { id: 'afraid', title: 'Ты боялся', subtitle: 'Оно чувствует твой страх.', weight: 'bad',
        condition: s => (s.emotions.fearful || 0) >= 5 },
    DEFIANT: { id: 'defiant', title: 'Ты не сдался', subtitle: 'Но оно терпеливо. Очень терпеливо.', weight: 'good',
        condition: s => s.faceLost >= 3 && s.threat < 90 },
    EMPTY: { id: 'empty', title: 'Ничего не осталось', subtitle: 'Камера была выключена. Но оно всё равно видело.', weight: 'neutral',
        condition: s => s.noCamera },
    LONELY: { id: 'lonely', title: 'Ты был один', subtitle: 'Как и всегда.', weight: 'neutral',
        condition: s => s.faceDetectedCount === 0 && !s.noCamera },

    FRIEND: { id: 'friend', title: 'Ты завёл друга', subtitle: 'Он никогда тебя не отпустит.', weight: 'neutral',
        condition: s => s.chatMessagesSent >= 5 && s.chatEndings.friend },
    BETRAYED: { id: 'betrayed', title: 'Ты предал его', subtitle: 'Ты написал грубость. Он запомнил.', weight: 'bad',
        condition: s => s.chatEndings.betrayed },
    REVEALED: { id: 'revealed', title: 'Ты узнал правду', subtitle: 'Но было поздно.', weight: 'bad',
        condition: s => s.chatEndings.revealed },
    SAVED: { id: 'saved', title: 'Ты спасся', subtitle: 'На этот раз.', weight: 'good',
        condition: s => s.chatEndings.saved && s.chatMessagesSent >= 3 },
    SILENT: { id: 'silent', title: 'Ты молчал', subtitle: 'Оно не любит тишину.', weight: 'bad',
        condition: s => s.chatMessagesSent === 0 && s.chatCompleted },
    OBSESSED: { id: 'obsessed', title: 'Оно одержимо', subtitle: 'Ты слишком долго с ним говорил.', weight: 'bad',
        condition: s => s.chatMessagesSent >= 15 },

    OBSERVED: { id: 'observed', title: 'Ты был послушным', subtitle: 'Оно довольно тобой. Пока что.', weight: 'neutral',
        condition: s => s.threat >= 60 && s.faceDetectedCount >= 5 },
    WATCHED: { id: 'watched', title: 'Ты просто смотрел', subtitle: 'Оно ждало большего.', weight: 'neutral',
        condition: () => true },
};

class EndingsManager {
    static determine(state) {
        const priority = [
            'CONSUMED', 'BETRAYED', 'REVEALED', 'SILENT',
            'OBSESSED', 'FRIEND', 'SAVED', 'AFRAID',
            'DEFIANT', 'EMPTY', 'LONELY', 'OBSERVED', 'WATCHED',
        ];
        for (const key of priority) {
            const e = ENDINGS[key];
            try { if (e.condition(state)) return e; } catch (err) {}
        }
        return ENDINGS.WATCHED;
    }
}