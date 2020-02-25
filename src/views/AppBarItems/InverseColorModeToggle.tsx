import React, { FunctionComponent } from "react";
import { observer, inject } from "mobx-react";

import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

//https://material-ui.com/components/switches/
import { Switch } from "@material-ui/core";

import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../../stores/UiPreferencesStore";

interface Use3dModeToggleProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
}

const Use3dModeToggle: FunctionComponent<Use3dModeToggleProps> = (
  props: Use3dModeToggleProps
) => {
  const { updateUse3dMode, use3dMode } = props.uiPreferencesStore!;

  const handleChange = (name: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let status = event.target.checked;
    console.log("changing inverse color mode to");
    console.log(status);
    updateUse3dMode(status);
  };

  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={use3dMode}
            onChange={handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
        }
        label="Use 3D"
      />
    </FormGroup>
  );
};

export default inject(
  "uiPreferencesStore",
  "routerStore"
)(observer(Use3dModeToggle));
