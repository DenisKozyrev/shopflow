// 1 task

const userService = {
    currentFilter: 'active',
    users: [
        { name: 'Alex', status: 'active' },
        {
            name: 'Nick', status: 'deleted'
        },
    ],
    getFilteredUsers: function () {
        return this.users.filter(function (user) {
            return user.status === userService.currentFilter;
        }, this);
    }
}

console.log(userService.getFilteredUsers())
// [] Тут внутри колбэка function declaration поэтому мы теряем контекст (она имеет свой контекст).
// Можно исправить используя callback function, или используя bind или прокинуть вторым аргументом this в фильтер.


// PromiseAll
function myPromiseAll(promises) {
    if (!Array.isArray(promises)) {
        return Promise.reject(new TypeError('Argument must be an array'));
    }
    if (promises.length === 0) {
        return Promise.resolve([]);
    }

    const results = new Array(promises.length);
    let resolvedCount = 0;

    return new Promise((resolve, reject) => {
        promises.forEach((promise, index) => {
            Promise.resolve(promise)
                .then((value) => {
                    results[index] = value;
                    resolvedCount++;
                    if (resolvedCount === promises.length) {
                        resolve(results);
                    }
                })
                .catch(reject);
        });
    });
}

//Promise.any
function myPromiseAny(promises) {
    if (!Array.isArray(promises)) {
        return Promise.reject(new TypeError('Argument must be an array'));
    }
    if (promises.length === 0) {
        return Promise.reject(new AggregateError([], 'All promises were rejected'));
    }

    return new Promise((resolve, reject) => {
        const errors = new Array(promises.length);
        let rejectedCount = 0;

        promises.forEach((promise, index) => {
            Promise.resolve(promise)
                .then(resolve)
                .catch((error) => {
                    errors[index] = error;
                    rejectedCount++;
                    if (rejectedCount === promises.length) {
                        reject(new AggregateError(errors, 'All promises were rejected'));
                    }
                });
        });
    });
}

// 2 task
console.log(1);

setTimeout(function () {
    console.log(2);
});

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);
// 1, 4, 6, 3, 2, 5

// если добавить
const foo1 = () => {
    console.log('foo1');
    return Promise.resolve().then(foo1)
}

foo1();

// вызов foo1 приведет к блокировке очереди микротасок,
// перед этим будет вызов синхронного кода 1, 4, 6, console.log('foo1'), 
// далее мы в очередь микротаскок положим  Promise.resolve().then(foo1) и
// потом положим Promise.resolve(3).then(console.log); поэтому 3 тоже отработает
// потом заблокируется и пойдет по кругу 1, 4, 6,'foo1', 3, 'foo1'(пойдет отрисовываться)

// 1, 4, 6,'foo1', 3, 'foo1...'

// если добавить 

console.log(1);

setTimeout(function () {
    console.log(2);
});

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);

const foo2 = () => {
    console.log('foo2');
    setTimeout(foo2);
}

foo2()

// когда доходим до foo2 мы вызваем console, потом ставим в очередь макротаску,
// потом микротаску, потом остальные макротаски, а потом замыкаемся на foo2 рекурсии.

// 1, 4, 6, 'foo2', 3, 2, 5, 'foo2...'

// добавляем 
console.log(1);

setTimeout(function () {
    console.log(2);
});

setTimeout(() =>
    Promise.resolve().then(() => console.log(7))
)

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);

// тут показана очередность макро и микро тасок 2, 7, 5, одна макро, потом все микро, потом опять макро

// 1, 4, 6, 3, 2, 7, 5


// eventEmmiter
class MyEventEmitter {
    constructor() {
        this.events = {}
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = []
        }

        this.events[eventName].push(listener)
        return this
    }

    off(eventName, listener) {
        if (!this.events[eventName]) {
            return this
        }

        this.events[eventName] = this.events[eventName].filter(eventListener => {
            return eventListener !== listener
        })

        return this
    }

    emit(eventName, ...args) {
        if (!this.events[eventName]) {
            return this
        }

        this.events[eventName].forEach(eventListener => {
            try {
                eventListener(...args)
            } catch (err) {
                console.log(err)
            }
        })

        return this
    }

}

const emitter = new MyEventEmitter()

const cb1 = (event) => console.log(event || 'cb1')
const cb2 = () => console.log('cb2')

const cb3Err = () => {
    throw new Error('error')
}

emitter
    .on('event', cb1)
    .on('event', cb2)
    .emit('event', 'bla bla ')
    .off('event', cb2)
    .emit('event', 1234, 123, 12)
    .on('error', cb3Err).emit('error')

// task
// Дан массив целых чисел. Разрешается выполнение следующей операции любое количество раз: два соседних элемента меняются между собой знаками
// Выведите максимальную сумму элементов массива, которую можно получить.
// maxPossibleSum([-2, 1, 3]) = 4 // -2 и 1 меняются знаками.

// deepCopy
function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    const clone = Array.isArray(obj) ? [] : {};

    for (let key in obj) {
        if (obj.has0wnProperty(key)) {
            clone[key] = deepClone(obj[key]);
        }
    }
    return clone;
}

function maxPossibleSum(arr) {
    const magnitudes = arr.map(Math.abs);
    const minusCount = arr.filter((number) => number < 0).length;

    magnitudes.sort((a, b) => a - b);

    const total = magnitudes.reduce((acc, n) => acc + n, 0)
    const penalty = magnitudes
        .slice(0, minusCount).reduce((s, m) => s + m, 0);

    return total - 2 * penalty
}

maxPossibleSum([-4, -2, 3, -2])


//task 
// поиск подстроки(или full text search)


// task
// Петя хочет устроить вечеринку. У него есть список друзей, заданный в виде двумерного массива [[w1, hy], [W2, h2], ...]. Все числа натуральные.
// Где w; - уровень достатка у і-ого друга, а h; - уровень счастья Пети, если
// этот друг будет присутствовать на встрече.
// Итоговое счастье Пети будет равняться сумме уровней счастья пришедших друзей.
// Также Петя знает, что если у кого-то из друзей уровень достатка в два или более раза меньше уровня достатка кого-либо на вечеринке, то он будет чуствовать себя некомфортно. Петя не хочет, чтобы кому-то из его гостей было некомфортно.
// Найдите максимальный уровень счастья вечеринки, которую может устроить Петя.
// maxHappiness([1,3], [5, 2], [3, 2]) => 4

// Даны строки start, finish и массив строк wordsl]. Все строки одной длины K.
// Строку start можно превратить в строку finish, если существует цепочка преобразований: start → s_1 →... → s_N - finish, в которой соседние строки отличаются ровно на одну
// букву и каждая строка s_і входит в массив wordsl].
// Найти длину кратчайшей цепочки преобразований из start в
// finish.
// Input: start = "пир", finish = "сок", words =
// ["пик", "кот", "сок", "тик", "тир", "ток", "ком"]
// Output: 5 (пир → тир → тик → ток → сок)

function differByOne(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return diff === 1;
}

function findWay(start, finish, words) {
    if (start === finish) return 1;
    const dict = new Set(words);

    dict.add(finish); // start уже в очереди

    const queue = [[start, 1]];
    const visited = new Set([start]);

    while (queue.length) {
        const [word, len] = queue.shift();
        for (const next of dict) {
            if (visited.has(next)) continue;
            if (!differByOne(word, next)) continue;
            if (next === finish) return len + 1;
            visited.add(next);
            queue.push([next, len + 1]);
        }
    }
    return 0; // пути нет
}

// task 
// чистый вариант 
const numUniqueEmails = function (emails) {
    const seen = new Set();
    for (const email of emails) {
        const [localPart, domain] = email.split('@');
        const local = localPart.split('+')[0].replaceAll('.', '');
        seen.add(`${local}@${domain}`);
    }
    return seen.size;
};

// task 
/**
* @param {number[]} nums
* @param {number} target
* @return {number[]} //indices
*/
const twoSum = function (nums, target) {
    const seen = new Map(); // value → index

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];

        if (seen.has(complement)) {
            return [seen.get(complement), i];
        }

        seen.set(nums[i], i);
    }

    return [];
};

// roatate string 
const rotateString = function (s, goal) {
    if (s.length !== goal.length) return false;
    if (s === goal) return true;

    for (let i = 0; i < s.length; i++) {
        s = s.slice(1) + s[0];
        if (s === goal) return true;
    }
    return false;
};

//lengthOfLongestSubstring
const lengthOfLongestSubstring = function (s) {
    const map = new Set();

    let letterIndex = 0
    let result = '';
    let resultLength = 0

    for (let i = 0; i < s.length;) {
        if (map.has(s[i])) {
            resultLength = result.length > resultLength ? result.length : resultLength
            result = ''
            letterIndex++
            i = letterIndex

            map.clear()
        } else {
            result = result + s[i];
            map.add(s[i])
            i++
        }
    }

    return resultLength
};

// You may recall that an array arr is a mountain array if and only if:

// arr.length >= 3
// There exists some index i (0-indexed) with 0 < i < arr.length - 1 such that:
// arr[0] < arr[1] < ... < arr[i - 1] < arr[i]
// arr[i] > arr[i + 1] > ... > arr[arr.length - 1]
// Given an integer array arr, return the length of the longest subarray, which is a mountain. Return 0 if there is no mountain subarray.



// Example 1:

// Input: arr = [2,1,4,7,3,2,5]
// Output: 5
// Explanation: The largest mountain is [1,4,7,3,2] which has length 5.
// Example 2:

// Input: arr = [2,2,2]
// Output: 0
// Explanation: There is no mountain.

/**
 * @param {number[]} arr
 * @return {number}
 */
var longestMountain = function (arr) {
    if (arr.length < 3) return 0;

    let maxLen = 0;

    // Пик: строго выше соседей
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i - 1] < arr[i] && arr[i] > arr[i + 1]) {
            let left = i - 1;
            let right = i + 1;

            // Расширяем подъём влево
            while (left > 0 && arr[left - 1] < arr[left]) {
                left--;
            }
            // Расширяем спуск вправо
            while (right < arr.length - 1 && arr[right + 1] < arr[right]) {
                right++;
            }

            maxLen = Math.max(maxLen, right - left + 1);
        }
    }

    return maxLen;
};

// task
var maxSubArray = function (nums) {
    const uniqArr = [...new Set(nums)]

    let result = 0
    let negative = null;

    for (let i = 0; i < uniqArr.length; i++) {
        if (uniqArr[i] > 0) {
            result += uniqArr[i]
        }

        if (uniqArr[i] < 0) {
            if (negative === null || uniqArr[i] > negative) {
                negative = uniqArr[i]
            }
        }
    }

    return result + negative
};