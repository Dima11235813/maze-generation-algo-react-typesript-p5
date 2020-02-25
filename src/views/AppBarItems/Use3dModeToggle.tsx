import React, { FunctionComponent, useContext } from "react";
import { observer, inject } from "mobx-react";

import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

//https://material-ui.com/components/switches/
import { Switch } from "@material-ui/core";

import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../../stores/UiPreferencesStore";
import { p5_MazeContext } from "../../AppContext";

interface InverseColorModeToggleProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
}

const Use3dModeToggle: FunctionComponent<InverseColorModeToggleProps> = (
  props: InverseColorModeToggleProps
) => {
  const { updateUse3dMode, use3dMode } = props.uiPreferencesStore!;
  const context = useContext(p5_MazeContext)
  const {p5_MazeFuncs } = context

  const handleChange = (name: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let status = event.target.checked;
    console.log("changing inverse color mode to");
    console.log(status);
    p5_MazeFuncs.resetMaze();
    updateUse3dMode(status);
  };

  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={use3dMode ? use3dMode : true}
            onChange={handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
        }
        label="Inverse Colors"
      />
    </FormGroup>
  );
};

export default inject(
  "uiPreferencesStore",
  "routerStore"
)(observer(Use3dModeToggle));
