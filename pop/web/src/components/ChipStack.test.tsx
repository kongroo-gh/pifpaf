import { expect, it } from "vitest";
import { ChipStack } from "./ChipStack";

it.each([0, 1, 4, 7, 20])("残数%iでもチップ画像は1枚だけ", (count) => {
  const element = ChipStack({ count });
  const children = Array.isArray(element.props.children)
    ? element.props.children.flat().filter(Boolean)
    : [element.props.children].filter(Boolean);
  expect(children).toHaveLength(1);
  expect(children[0].props.className).toBe("chipStack__chip");
});
