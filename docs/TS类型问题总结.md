## 字面量对象属性类型拓宽

1. `otherGroups.map`返回的是一个字面量对象的数组
2. TS的类型拓宽：`refetchOnMount: "always"`这样的属性，TS默认会把`refetchOnMount`的类型推断为`string`，但实际上它的类型为`boolean | 'always' | ...`，类型可以自动以窄类型匹配宽类型，不能反过来
3. `as const` 是TS 3.4 加入的语法，专门用来关闭上面那个拓宽行为

```ts
const otherGroupQueries = useQueries({
  queries: otherGroups.map((group) => ({
    queryKey: [
      // ...省略
    ],
    queryFn: async () => {
      // ...省略
    },
    enabled: weekRange.from !== "" && weekRange.to !== "",
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
    // ...省略
  })),
});
```
