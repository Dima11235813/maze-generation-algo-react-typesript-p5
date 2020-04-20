import React from "react";
import { Route } from "react-router";

//Views
import Home from "./views/Home/Home";
import MazeContainer from "./views/MazeContainer";
import LoginView from "./views/Login/LoginView";

//
import { APP_ROUTES } from "./utils/routeUtils";
import ComponentThatThrows from "./ComponentThatThrows";
// import { errorHandler } from "./errorHandler";

const accountRoute = `/${APP_ROUTES.ACCOUNT}`;
const loginRoute = `/${APP_ROUTES.LOGIN}`;
const mazeRoute = `/${APP_ROUTES.MAZE}`;

export function AppRoutes() {
  return [
    <Route
      key=""
      exact
      path="/"
      render={() => {
        //TODO Add page logging for google analytics integration
        // errorHandler.report("Test error report on home route")
        return <Home />;
      }}
    />,
    <Route key={mazeRoute} exact path={mazeRoute} component={MazeContainer} />,
    <Route
      key={loginRoute}
      exact
      path={loginRoute}
      render={() => {
        return <ComponentThatThrows />;
      }}
    />,
    // <Route key={loginRoute} exact path={loginRoute} component={LoginView} />,
    <Route key={accountRoute} exact path={accountRoute} component={Home} />,
  ];
}
