import React from "react";
import { P5_MazeContext, P5_MazeContextInitialValue } from "./AppContext";
import { MazeOptions } from "./mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "./mazeGenComp/mazeUtils/mazeOptionsSetter";
import App from "./App";

export interface P5_MazeState {
  mazeOptions: MazeOptions;
  mazeOptionsSetter: MazeOptionsSetter;
}
export const AppWrapper = () => {
  return (
    <P5_MazeContext.Provider value={P5_MazeContextInitialValue}>
      <App />;
    </P5_MazeContext.Provider>
  );
};
