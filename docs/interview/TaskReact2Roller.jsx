// Реализовать простую имплементацию слот-машины ("однорукий бандит"):
// • Реализуйте три барабана (с цифрами от 0 до 9, которые меняются по-очереди 0,1,2...9,0,1,2...)
// • На каждый onRoll на барарабане выпадает следующее значение
// • Если все три цифры совпали после остановки - говорим, что победил
// • Дизаблим кнопку на время вращения

import React, { useEffect, useState } from "react";

function randomInt(min = 0, max = 9) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
Функция имитирует вращение барабана с постепенной остановкой
- используй onRoll для анимации вращения (смена текущего значения)
- и onStop для оповещения, когда барабан закончил крутиться пример
runSpinner (
() => setValue (v = ++v % 10),
() => console. log('finished' )
)
**/

function runSpinner(onRoll, onStop) {
  const velocityPerRound = 200;
  const initialSpinTime = 50;

  const initialVelocity = randomInt(3000, 5000);
  let remainVelocity = initialVelocity;

  const round = () => {
    const nextRoundSpinTime =
      (initialVelocity - remainVelocity) / velocityPerRound + initialSpinTime;
    remainVelocity -= velocityPerRound;

    if (remainVelocity < 0) {
      onStop();
      return;
    }

    onRoll();
    setTimeout(round, nextRoundSpinTime);
  };
  setTimeout(round, initialSpinTime);
}

function Roller({ spin, onStop, order }) {
  const [value, setValue] = useState(0);

  const onRoll = () => {
    setValue((v) => ++v % 10);
  };

  const handleStop = () => {
    onStop(order, value);
  };

  useEffect(() => {
    if (spin) {
      runSpinner(onRoll, handleStop);
    }
  }, [spin]);

  return <p>{value}</p>;
}

function App() {
  const [spin, setSpin] = useState(false); // для старта спина
  
  const [_, setStopCounter] = useState(0); // для счетчика чтобы после остановки определить победителя

  const [isWin, setIsWin] = useState(false); // для победы

  const results = {};

  const onStop = (order, value) => {
    setStopCounter((counter) => {
      counter += 1;
      results[order] = value;

      if (counter === 3) {
        setSpin(false);
        if (results[1] + results[2] + results[3] / 3 === 1) {
          setIsWin(true);
        }
        return 0;
      }
      return counter;
    });

    console.log(isWin, "isWin!!");
    console.log("finished");
  };

  const handleClick = () => {
    setIsWin(false);
    setSpin(true);
  };

  return (
    <div
      style={{
        width: "1000px",
        backgroundColor: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
          width: "100%",
          color: "#000",
          fontSize: "64px",
        }}
      >
        <button style={{ margin: "5px 30px" }} onClick={handleClick}>
          spin!
        </button>

        <Roller order={1} spin={spin} onStop={onStop} />
        <Roller order={2} spin={spin} onStop={onStop} />
        <Roller order={3} spin={spin} onStop={onStop} />

        {isWin && <p>You win!</p>}
      </div>
    </div>
  );
}

export default App;
