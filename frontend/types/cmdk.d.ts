declare module "cmdk" {
  import * as React from "react";

  type PrimitiveProps = React.ComponentPropsWithRef<any> & { children?: React.ReactNode };

  export const Command: React.ComponentType<PrimitiveProps> & {
    Input: React.ComponentType<PrimitiveProps>;
    List: React.ComponentType<PrimitiveProps>;
    Empty: React.ComponentType<PrimitiveProps>;
    Group: React.ComponentType<PrimitiveProps>;
    Separator: React.ComponentType<PrimitiveProps>;
    Item: React.ComponentType<PrimitiveProps>;
  };

  export default Command;
}
