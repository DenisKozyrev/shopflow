/**
 * Приложение содержит кнопку, при нажатии на которую должен появиться инпут с фокусом. 
 * Но почему-то это не работает.
    Расскажите, почему возникает такая проблема и предложите варианты ее исправления.
 */

import { useRef, useState, useEffect, useLayoutEffect } from "react";

// export default function App() {
//   const [isVisible, setIsVisible] = useState(false);
//   const inputRef = useRef();

//   const showInput = () => {
//     setIsVisible(true);
//     inputRef.current.focus();
//   };

//   return (
//     <div>
//       <button onClick={showInput}>Show and focus input</button>
//       {isVisible && <input ref={inputRef} type="text" />}
//     </div>
//   );
// }

export default function App() {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const showInput = () => {
    setIsVisible(true);
  };

  return (
    <div>
      <button onClick={showInput}>Show and focus input</button>
      {isVisible && <input ref={inputRef} type="text" />}
    </div>
  );
}

// альтернативы это атрибут autoFocus, Callback ref, Всегда рендерить инпут, скрывать через CSS
