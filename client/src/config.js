import { createContext, useContext } from "react";

export const ConfigContext = createContext(null);
export const useConfig = () => useContext(ConfigContext);
