---
title: Callouts
description: The five GitHub alerts, an explicit heading id and raw HTML.
sidebar:
  label: Alerts
  order: 1
---

## Before you start {#before-you-start}

> [!NOTE]
> Measurements are exact for circles and polygons.

> [!TIP]
> Reuse a `Shapes.Builder` to build many shapes.

> [!IMPORTANT]
> Shapes are immutable: every transform returns a new shape.

> [!WARNING]
> A polygon whose edges cross has no defined area.

> [!CAUTION]
> `Shapes.parse` reads untrusted text: limit its input size.
>
> It allocates one object per vertex.

## A plain quote

> Geometry is the art of correct reasoning from incorrectly drawn figures.

## Raw HTML

Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy. Water is H<sub>2</sub>O, and E = mc<sup>2</sup>.
<!-- An inline comment, which does not render. -->

<dl>
  <dt>Area</dt>
  <dd>The size of the inside.</dd>
</dl>

---

Back to the [concepts](index.md#shapes).
