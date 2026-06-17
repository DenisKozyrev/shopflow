async function promiseObject(object) {
  const entries = await Promise.all(
    Object.entries(object).map(async ([key, value]) => {
      if (value && typeof value === 'object' && !value.then) {
        return [key, await promiseObject(value)];
      }

      return [key, await value];
    }),
  );

  return Object.fromEntries(entries);
}

test('works like Promise.all, but for objects', async () => {
  const result = await promiseObject({
    name: Promise.resolve('John Lennon'),
    spouse: {
      name: Promise.resolve('Yoko Ono'),
    },
  });

  expect(result).toEqual({
    name: 'John Lennon',
    spouse: {
      name: 'Yoko Ono',
    },
  });
});
