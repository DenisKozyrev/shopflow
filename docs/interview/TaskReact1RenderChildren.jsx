import React from "react";

// Вопрос про то, какие компоненты будут перерендываться при клике на Render button
// и будет ли перерендыриваться children при изменении input

// Будут редериться все компоненты от родителя к ребенку, так все без мемоизации.
// Будет так же перередериваться children при изменении инпута

// иправить можно добавив мемоизацию и useCallback

function useForceUpdate() {
  const [, setCount] = React.useState(0);

  return () => {
    setCount((c) => c + 1);
  };
}

export default function App() {
  const forceUpdate = useForceUpdate();

  return (
    <div style={{ margin: "20px", padding: "20px", border: "2px" }}>
      <button onClick={forceUpdate}>Render</button>

      {/* <RenderCount /> */}
      <Parent />
    </div>
  );
}

const Parent = () => {
  const [value, setValue] = React.useState("");
  
  const handleChange = useCallback((e) => {
    setValue(e.target.value);
  });

  return (
    <form style={{ margin: "20px", padding: "20px", border: "2px" }}>
      Input value is: {value}
      {/* <RenderCount /> */}
      <Child onChange={handleChange} />
    </form>
  );
};

const Child = React.memo(({ onChange }) => {
  return (
    <div style={{ padding: "20px", margin: "20px", border: "2px" }}>
      <input type="text" name="value" onChange={onChange} />
      {/* <RenderCount /> */}
    </div>
  );
});

function RenderCount() {
  const renderCount = React.useRef(1);
  React.useEffect(() => {
    renderCount.current += 1;
  });
  return <div style={{ marginTop: "10px" }}>Render count {renderCount}</div>;
}
