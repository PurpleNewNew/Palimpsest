import "@/index.css"
import { File } from "@palimpsest/ui/file"
import { I18nProvider } from "@palimpsest/ui/context"
import { DialogProvider } from "@palimpsest/ui/context/dialog"
import { FileComponentProvider } from "@palimpsest/ui/context/file"
import { MarkedProvider } from "@palimpsest/ui/context/marked"
import { Font } from "@palimpsest/ui/font"
import { ThemeProvider } from "@palimpsest/ui/theme"
import { MetaProvider } from "@solidjs/meta"
import { BaseRouterProps, Navigate, Route, Router } from "@solidjs/router"
import { Component, ErrorBoundary, type JSX, lazy, Match, type ParentProps, Show, Suspense, Switch } from "solid-js"
import { CommandProvider } from "@/context/command"
import { CommentsProvider } from "@/context/comments"
import { FileProvider } from "@/context/file"
import { GlobalSDKProvider } from "@/context/global-sdk"
import { GlobalSyncProvider } from "@/context/global-sync"
import { HighlightsProvider } from "@/context/highlights"
import { LanguageProvider, useLanguage } from "@/context/language"
import { LayoutProvider } from "@/context/layout"
import { ModelsProvider } from "@/context/models"
import { NotificationProvider } from "@/context/notification"
import { PermissionProvider } from "@/context/permission"
import { usePlatform } from "@/context/platform"
import { PromptProvider } from "@/context/prompt"
import { type ServerConnection, ServerProvider, useServer } from "@/context/server"
import { SettingsProvider } from "@/context/settings"
import { TerminalProvider } from "@/context/terminal"
import { AuthProvider, useAuth } from "@/context/auth"
import DirectoryLayout from "@/pages/directory-layout"
import Layout from "@/pages/layout"
import { ErrorPage } from "./pages/error"
import { Dynamic } from "solid-js/web"

const Home = lazy(() => import("@/pages/home"))
const Login = lazy(() => import("@/pages/login"))
const Session = lazy(() => import("@/pages/session"))
const Reviews = lazy(() => import("@/pages/reviews"))
const Nodes = lazy(() => import("@/pages/nodes"))
const Runs = lazy(() => import("@/pages/runs"))
const Artifacts = lazy(() => import("@/pages/artifacts"))
const Decisions = lazy(() => import("@/pages/decisions"))
const Sources = lazy(() => import("@/pages/sources"))
const Monitors = lazy(() => import("@/pages/monitors"))
const Loading = () => <div class="size-full" />

const HomeRoute = () => (
  <Suspense fallback={<Loading />}>
    <Home />
  </Suspense>
)

const SessionRoute = () => (
  <SessionProviders>
    <Suspense fallback={<Loading />}>
      <Session />
    </Suspense>
  </SessionProviders>
)

const ReviewsRoute = () => (
  <Suspense fallback={<Loading />}>
    <Reviews />
  </Suspense>
)

const NodesRoute = () => (
  <Suspense fallback={<Loading />}>
    <Nodes />
  </Suspense>
)

const RunsRoute = () => (
  <Suspense fallback={<Loading />}>
    <Runs />
  </Suspense>
)

const ArtifactsRoute = () => (
  <Suspense fallback={<Loading />}>
    <Artifacts />
  </Suspense>
)

const DecisionsRoute = () => (
  <Suspense fallback={<Loading />}>
    <Decisions />
  </Suspense>
)

const SourcesRoute = () => (
  <Suspense fallback={<Loading />}>
    <Sources />
  </Suspense>
)

const MonitorsRoute = () => (
  <Suspense fallback={<Loading />}>
    <Monitors />
  </Suspense>
)

const DirectoryIndexRoute = () => <Navigate href="nodes" />

function UiI18nBridge(props: ParentProps) {
  const language = useLanguage()
  return <I18nProvider value={{ locale: language.locale, t: language.t }}>{props.children}</I18nProvider>
}

declare global {
  interface Window {
    __PALIMPSEST__?: {
      updaterEnabled?: boolean
      deepLinks?: string[]
    }
  }
}

function MarkedProviderWithNativeParser(props: ParentProps) {
  const platform = usePlatform()
  return <MarkedProvider nativeParser={platform.parseMarkdown}>{props.children}</MarkedProvider>
}

function AppShellProviders(props: ParentProps) {
  return (
    <SettingsProvider>
      <PermissionProvider>
        <LayoutProvider>
          <NotificationProvider>
            <ModelsProvider>
              <CommandProvider>
                <HighlightsProvider>
                  <Layout>{props.children}</Layout>
                </HighlightsProvider>
              </CommandProvider>
            </ModelsProvider>
          </NotificationProvider>
        </LayoutProvider>
      </PermissionProvider>
    </SettingsProvider>
  )
}

function SessionProviders(props: ParentProps) {
  return (
    <TerminalProvider>
      <FileProvider>
        <PromptProvider>
          <CommentsProvider>{props.children}</CommentsProvider>
        </PromptProvider>
      </FileProvider>
    </TerminalProvider>
  )
}

function RouterRoot(props: ParentProps<{ appChildren?: JSX.Element }>) {
  return (
    <AppShellProviders>
      {props.appChildren}
      {props.children}
    </AppShellProviders>
  )
}

export function AppBaseProviders(props: ParentProps) {
  return (
    <MetaProvider>
      <Font />
      <ThemeProvider>
        <LanguageProvider>
          <UiI18nBridge>
            <ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
              <DialogProvider>
                <MarkedProviderWithNativeParser>
                  <FileComponentProvider component={File}>{props.children}</FileComponentProvider>
                </MarkedProviderWithNativeParser>
              </DialogProvider>
            </ErrorBoundary>
          </UiI18nBridge>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}

function ServerKey(props: ParentProps) {
  const server = useServer()
  return (
    <Show when={server.key} keyed>
      {props.children}
    </Show>
  )
}

function AuthGate(props: ParentProps) {
  const auth = useAuth()
  return (
    <Switch>
      <Match when={auth.status() === "loading"}>
        <Loading />
      </Match>
      <Match when={auth.status() === "guest"}>
        <Suspense fallback={<Loading />}>
          <Login />
        </Suspense>
      </Match>
      <Match when={true}>{props.children}</Match>
    </Switch>
  )
}

export function AppInterface(props: {
  children?: JSX.Element
  defaultServer: ServerConnection.Key
  servers?: Array<ServerConnection.Any>
  router?: Component<BaseRouterProps>
}) {
  return (
    <ServerProvider defaultServer={props.defaultServer} servers={props.servers}>
      <ServerKey>
        <AuthProvider>
          <AuthGate>
            <GlobalSDKProvider>
              <GlobalSyncProvider>
                <Dynamic
                  component={props.router ?? Router}
                  root={(routerProps) => <RouterRoot appChildren={props.children}>{routerProps.children}</RouterRoot>}
                >
                  <Route path="/" component={HomeRoute} />
                  <Route path="/:dir" component={DirectoryLayout}>
                    <Route path="/" component={DirectoryIndexRoute} />
                    <Route path="/session/:id?" component={SessionRoute} />
                    <Route path="/reviews" component={ReviewsRoute} />
                    <Route path="/reviews/:proposalID" component={ReviewsRoute} />
                    <Route path="/nodes" component={NodesRoute} />
                    <Route path="/nodes/:nodeID" component={NodesRoute} />
                    <Route path="/runs" component={RunsRoute} />
                    <Route path="/runs/:runID" component={RunsRoute} />
                    <Route path="/artifacts" component={ArtifactsRoute} />
                    <Route path="/artifacts/:artifactID" component={ArtifactsRoute} />
                    <Route path="/decisions" component={DecisionsRoute} />
                    <Route path="/decisions/:decisionID" component={DecisionsRoute} />
                    <Route path="/sources" component={SourcesRoute} />
                    <Route path="/sources/:sourceID" component={SourcesRoute} />
                    <Route path="/monitors" component={MonitorsRoute} />
                  </Route>
                </Dynamic>
              </GlobalSyncProvider>
            </GlobalSDKProvider>
          </AuthGate>
        </AuthProvider>
      </ServerKey>
    </ServerProvider>
  )
}
