import React from "react";
import {
  P5_MazeContextInitialValue,
  p5_MazeContext,
  MazeOptionsUiContextInitialValue,
  mazeOptionsUiContext,
} from "./AppContext";
import { MazeOptions } from "./mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "./mazeGenComp/mazeUtils/mazeOptionsSetter";
import App from "./App";
import { Provider } from "mobx-react";
import { stores } from "./stores";

export interface P5_MazeState {
  mazeOptions: MazeOptions;
  mazeOptionsSetter: MazeOptionsSetter;
}
export const AppWrapper = () => {
  return (
    <p5_MazeContext.Provider value={P5_MazeContextInitialValue}>
      <mazeOptionsUiContext.Provider value={MazeOptionsUiContextInitialValue}>
        <Provider {...stores}>
          <>
            <App />
          </>
        </Provider>
      </mazeOptionsUiContext.Provider>
    </p5_MazeContext.Provider>
  );
};
