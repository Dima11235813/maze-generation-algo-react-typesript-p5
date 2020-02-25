import React from "react";
import { stores } from "./stores";
import { Provider } from "mobx-react";

//Contexts
import {
  P5_MazeContextInitialValue,
  p5_MazeContext,
  MazeOptionsUiContextInitialValue,
  mazeOptionsUiContext
} from "./AppContext";
import App from "./App";

const AppWrapper = () => {
  return (
    <p5_MazeContext.Provider value={P5_MazeContextInitialValue}>
      <mazeOptionsUiContext.Provider value={MazeOptionsUiContextInitialValue}>
        <Provider {...stores}>
          <App />
        </Provider>
      </mazeOptionsUiContext.Provider>
    </p5_MazeContext.Provider>
  );
};
export default AppWrapper;
