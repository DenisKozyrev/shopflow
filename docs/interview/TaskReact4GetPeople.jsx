import React, { useEffect, useState } from "react";

function getPeople(name, page = 1, options = {}) {
  return fetch(
    `https://rickandmortyapi.com/api/character?name=${name}&page=${page}`,
    options,
  )
    .then((res) => res.json())
    .catch((err) => {
      console.log(err);
    });
}

const useDebounce = (value, ms) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [value, ms]);

  return { debouncedValue };
};

export default function App() {
  const [searchValue, setSearchValue] = useState("");

  const { debouncedValue: debouncedSearchValue } = useDebounce(
    searchValue,
    400,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const handleChange = (e) => {
    setSearchValue(e.target.value);
  };

  useEffect(() => {
    const controller = new AbortController();

    async function getData() {
      if (debouncedSearchValue) {
        try {
          setIsLoading(true);
          const result = await getPeople(debouncedSearchValue, 1, {
            signal: controller.signal,
          });

          setIsLoading(false);

          if (result.error) {
            setError(result.error);
            setData(null);
          } else {
            setData(result);
            setError("");
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        setError("");
        setIsLoading(false);
        setData(null);
      }
    }

    getData();

    return () => controller.abort();
  }, [debouncedSearchValue]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor="search">
        {isLoading ? "Loading..." : "Search Input"}
      </label>
      <input
        id="search"
        type="text"
        onChange={handleChange}
        value={searchValue}
      />
      <div>
        {error && <p>{error}</p>}
        <ul>
          {data &&
            !!data.results.length &&
            data.results.map((person) => {
              return <li key={person.id}>{person.name}</li>;
            })}
        </ul>
      </div>
    </div>
  );
}
