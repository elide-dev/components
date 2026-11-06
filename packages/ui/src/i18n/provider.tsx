import * as React from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { en, mergeMessages, type PartialMessages } from "./messages";
import { MessagesContext } from "./context";
import { LocaleContext, useLocale } from "./locale-context";
import { localeInfo, resolveLocale, type Direction } from "./locales";

export interface MessagesProviderProps {
  /** Explicit catalog, merged over English (or the parent catalog for nested overrides). */
  messages?: PartialMessages;
  /** BCP 47 language. Does not fetch translations; supply messages for SSR-safe rendering. */
  locale?: string;
  direction?: Direction;
  children: React.ReactNode;
}

/** No DOM wrapper or document mutation. Set lang/dir on your app root, or use I18nProvider. */
export function MessagesProvider({ messages, locale, direction, children }: MessagesProviderProps) {
  const parentMessages = React.useContext(MessagesContext);
  const parent = useLocale();
  const language = React.useMemo(() => {
    if (!locale) return parent.locale;
    try { return new Intl.Locale(locale).toString(); }
    catch { return "en"; }
  }, [locale, parent.locale]);
  const dir = direction ?? (locale ? localeInfo[resolveLocale(language)].direction : parent.direction);
  const value = React.useMemo(
    () => mergeMessages(locale && language !== parent.locale ? en : parentMessages, messages),
    [locale, language, parent.locale, parentMessages, messages],
  );
  const settings = React.useMemo(() => ({ locale: language, direction: dir }), [language, dir]);
  return (
    <LocaleContext.Provider value={settings}>
      <DirectionProvider direction={dir}>
        <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
      </DirectionProvider>
    </LocaleContext.Provider>
  );
}

export interface I18nProviderProps extends MessagesProviderProps,
  Omit<React.ComponentProps<"div">, "children" | "dir" | "lang"> {}

/** Scoped HTML language/direction plus Base UI keyboard behavior, including portals. */
export function I18nProvider({ messages, locale, direction, children, ...props }: I18nProviderProps) {
  return (
    <MessagesProvider messages={messages} locale={locale} direction={direction}>
      <LocaleRoot {...props}>{children}</LocaleRoot>
    </MessagesProvider>
  );
}
function LocaleRoot({ children, ...props }: React.ComponentProps<"div">) {
  const { locale, direction } = useLocale();
  return <div {...props} lang={locale} dir={direction}>{children}</div>;
}
