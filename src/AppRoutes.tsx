import React from "react";
import { Route } from "react-router";

//Views
import Home from "./views/Home/Home";
import MazeContainer from "./views/MazeContainer";
import LoginView from "./views/Login/LoginView";

//
import { APP_ROUTES } from "./utils/routeUtils";

const accountRoute = `/${APP_ROUTES.ACCOUNT}`;
const loginRoute = `/${APP_ROUTES.LOGIN}`;
const mazeRoute = `/${APP_ROUTES.MAZE}`;

export function AppRoutes() {
  return [
    <Route key="" exact path="/" component={Home} />,
    <Route key={mazeRoute} exact path={mazeRoute} component={MazeContainer} />,
    <Route key={loginRoute} exact path={loginRoute} component={LoginView} />,
    <Route key={accountRoute} exact path={accountRoute} component={Home} />
  ];
}
