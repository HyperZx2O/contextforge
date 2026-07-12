export function titleOf(nodes, id) {
  const node = nodes.find((n) => n.id === id);
  return node?.properties?.title || id;
}
