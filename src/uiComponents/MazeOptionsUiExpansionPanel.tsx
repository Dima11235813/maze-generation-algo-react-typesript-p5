import React, { CSSProperties, FunctionComponent } from "react";

import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import { Labels } from "../shared/labels";
import { ExpansionPanelWrapper } from "./MazeOptionsUiExpansionPanel/ExpansionPanel";
import { CellSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellSizeSliderWrapper";
import { CellWallSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellWallSizeSliderWrapper";
import { CellColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellColorSelectWrapper";
import { CellWallColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellWallColorSelectWrapper";
import { MazeBackgroundColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/MazeBackgroundColorSelectWrapper.";
import { CellWallStyleWrapper } from "./MazeOptionsUiExpansionPanel/CellWallStyleWrapper";
import InverseColorModeToggle from "../views/AppBarItems/InverseColorModeToggle";
import Use3dModeToggle from "../views/AppBarItems/Use3dModeToggle";
import { FrameRateSliderWrapper } from "./MazeOptionsUiExpansionPanel/NumberBasedSelections/FrameRateSliderWrapper";
import AnimateMirrorToggle from "../views/AppBarItems/AnimateMirrorToggle";
import { stores } from "../stores";
import MazeGenCubeProjectionShowToggle from "../views/AppBarItems/MazeGenCubeProjectionShowToggle";
import { inject, observer } from "mobx-react";
import { MazeViewStore } from "../stores/MazeViewStore";
import { UiPreferencesStore } from "../stores/UiPreferencesStore";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    }
  })
);



const toggleOptionsWrapper: CSSProperties = {
  display: "flex",
  flexDirection: "column",
}


interface MazeOptionsUiExpansionPanelProps {
  mazeViewStore?: MazeViewStore;
  uiPreferencesStore?: UiPreferencesStore;
}


//TODO Move to maze options ui defaults
const MazeOptionsUiExpansionPanel: FunctionComponent<MazeOptionsUiExpansionPanelProps> = (
  props: MazeOptionsUiExpansionPanelProps
) => {
  const classes = useStyles();
  const { showGeneratorCubeProjection } = props.mazeViewStore!
  const { use3dMode } = props.uiPreferencesStore!;
  return (
    <div className={classes.root}>
      <ExpansionPanelWrapper
        panelIsExpanded={false}
        name={Labels.HEADER}
        render={() => (
          <>
            <div style={toggleOptionsWrapper}>
              <Use3dModeToggle key="use3d" />
              <InverseColorModeToggle key="inverseColors" />
              {/* Only only offer projection if in 3d color mode*/}
              {use3dMode ? <MazeGenCubeProjectionShowToggle key="mazeGenProjection" /> : null}
              {/* Only offer mirror optino if showing projection */}
              {use3dMode && showGeneratorCubeProjection ? <AnimateMirrorToggle key="animateMirror" /> : null}
            </div>
          </>
        )}
      />
      <FrameRateSliderWrapper />
      <CellSizeSliderWrapper />
      <CellWallSizeSliderWrapper />
      <CellColorSelectWrapper />
      <CellWallColorSelectWrapper />
      <MazeBackgroundColorSelectWrapper />
      {/* {use3dMode ? null : <CellWallStyleWrapper />  */}
      }
    </div>
  );
}

export default inject(
  "uiPreferencesStore",
  "mazeViewStore",
  "routerStore"
)(observer(MazeOptionsUiExpansionPanel));

