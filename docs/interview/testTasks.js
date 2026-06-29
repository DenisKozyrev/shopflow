function differByOne(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return diff === 1;
}

function findWay(start, finish, words) {
    const result = [start, finish];
    let newStart = start;
    let newFinish = finish;

    const filteredWords = words.filter((w) => w !== start && w !== start);

    if (filteredWords.length > 1) {
        for (let i = 0; i < filteredWords.length;) {
            const word = filteredWords[i];
            if (differByOne(word, newStart)) {
                result.splice(result.indexOf(newStart), 0, filteredWords[i]);
                filteredWords.splice(i, 1);
                i = 0
            } else if (differByOne(word, newFinish)) {
                result.splice(result.indexOf(newFinish) - 1, 0, filteredWords[i]);
                filteredWords.splice(i, 1);
                i = 0
            } else {
                i++
            }
        }

    } else {
        result.toSpliced(1, 0, filteredWords[0])
    }
    console.log(result, 'result!!')
}

findWay("пир", "сок", ["пик", "кот", "сок", "тик", "тир", "ток", "ком"])