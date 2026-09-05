import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
function App() {
  const [model, setModel] = useState({
    name: "",
    email: "",
    gender: "",
    cities: [],
    privacy: false,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    window.reactModel = model;
  }, [model]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        window.submitCount = (window.submitCount || 0) + 1;
      }}
    >
      <fieldset>
        <legend>基本信息</legend>
        <label>
          姓名
          <input
            name="name"
            value={model.name}
            onChange={(e) => setModel((m) => ({ ...m, name: e.target.value }))}
          />
        </label>
        <label>
          电子邮箱
          <input
            name="email"
            type="email"
            value={model.email}
            onChange={(e) => setModel((m) => ({ ...m, email: e.target.value }))}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>性别</legend>
        {["女", "男"].map((g) => (
          <label key={g}>
            <input
              type="radio"
              name="gender"
              value={g}
              checked={model.gender === g}
              onChange={(e) =>
                setModel((m) => ({ ...m, gender: e.target.value }))
              }
            />
            {g}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>意向城市</legend>
        {["示例市甲", "示例市乙"].map((city) => (
          <label key={city}>
            <input
              type="checkbox"
              name="cities"
              value={city}
              checked={model.cities.includes(city)}
              onChange={(e) =>
                setModel((m) => ({
                  ...m,
                  cities: e.target.checked
                    ? [...m.cities, city]
                    : m.cities.filter((v) => v !== city),
                }))
              }
            />
            {city}
          </label>
        ))}
      </fieldset>
      <label>
        <input
          type="checkbox"
          name="privacy"
          checked={model.privacy}
          onChange={(e) =>
            setModel((m) => ({ ...m, privacy: e.target.checked }))
          }
        />
        我同意隐私协议
      </label>
      <button type="button" id="rerender" onClick={() => setTick((t) => t + 1)}>
        重新渲染 {tick}
      </button>
      <button type="submit">最终提交</button>
    </form>
  );
}
createRoot(document.getElementById("app")).render(<App />);
