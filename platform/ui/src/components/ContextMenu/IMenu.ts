import { Types } from "@ohif/ui";

export interface IMenuItem {
  id: string;
  label?: string;
  code?: string;
  ref?: Record<string, unknown>;
  action?: string;
  delegating?: boolean;
  subMenu?: string;
  checkFunction?: (props: Types.Object) => boolean;
  actionType?: string;
  commandName?: string;
  commands?: Types.ICommand[];
};

/**
 * A GUI List is a list of child components,
 * which can be a simple list of labels, or it
 * can be a list of values and a getter.
 * The intent is to allow generating the list
 * dynamically at runtime, based on pre-configured
 * lists and selectors.
 */
export default interface IMenu {
  id: string;
  selector?: Types.Predicate;
  attribute?: string;

  items: IMenuItem[];
}
