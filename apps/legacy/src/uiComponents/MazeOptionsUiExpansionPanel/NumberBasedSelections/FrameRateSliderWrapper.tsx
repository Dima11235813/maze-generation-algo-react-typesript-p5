import React, { useContext } from "react";
import {
  p5_MazeContext,
  P5_MazeContext,
  mazeOptionsUiContext,
  MazeOptionsUiContext
} from "../../../AppContext";
import { ExpansionPanelWrapper } from "../ExpansionPanel";
import { Labels } from "../../../shared/labels";
import FrameRateSlider from "../../FrameRateSlider";

export const FrameRateSliderWrapper = () => {
  let mazeContextInstance: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContextInstance;
  const {panelIsExpandedState} = mazeOptionsUiContextInstance
  const { resetMaze } = p5_MazeFuncs;
  return (
    <ExpansionPanelWrapper
      name={Labels.FRAME_RATE}
      panelIsExpanded={panelIsExpandedState.frameRate}
      render={() => (
        <FrameRateSlider
          mazeOptionsSetter={mazeOptionsSetter}
          onFrameChange={resetMaze}
          frameRate={mazeOptions.frameRate}
        />
      )}
    />
  );
};
