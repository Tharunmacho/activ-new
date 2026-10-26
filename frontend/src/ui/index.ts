/**
 * ============================================================================
 * THE ACTIV MOBILE DESIGN KIT — style guide (read before touching a screen)
 * ============================================================================
 *
 *   import { Screen, AppHeader, Hero, Section, Card, ListRow, PrimaryButton,
 *            BottomActionBar, PALETTE, SPACE, RADIUS, TYPE, useApi, money } from '../../ui';
 *
 * Tone: `tone="member"` (ACTIV blue, default) for member / payment;
 * `tone="business"` (violet, the website's Business card) for screens/business;
 * `tone="admin"` (indigo) for every admin tier and Super Admin. Pass the same
 * tone to Screen, AppHeader, Hero, SegmentedTabs, buttons, Field and states.
 * Never purple on the member side. Never a hard-coded hex — PALETTE only
 * (semantic aliases: primary / surface / background / success / warning /
 * danger / info, each with *Soft and *Text).
 *
 * ---------------------------------------------------------------- COMPOSITION
 *
 *   <Screen tone edges footer={<BottomActionBar>…</BottomActionBar>}>
 *     <AppHeader title subtitle onBack right={<IconButton/>} />   ← or <Hero/> on dashboards
 *     <Hero … />                         (optional, dashboards/detail tops; sits on the gutter itself)
 *     <Notice … />                       (optional page-level banner, directly under the header)
 *     <Section title="…" first>          (gutter SPACE.lg + SPACE.md gap between children)
 *       <Card>…InfoRow / ListRow / KeyValueGrid…</Card>
 *     </Section>
 *     <SectionTitle title="Stats" /> <StatGrid><StatTile/><StatTile/></StatGrid>
 *   </Screen>
 *
 *  1. Screen owns the canvas, status bar, safe area and ScrollView.
 *     - Default edges={['top']}. Use edges={[]} when the navigator / parent
 *       dashboard already applies the top inset (embedded tab screens —
 *       CLAUDE.md Rule 4). Never nest a SafeAreaView inside Screen.
 *     - Lists: <Screen scroll={false}> + FlatList (keyExtractor with fallback,
 *       initialNumToRender={10}, maxToRenderPerBatch={10},
 *       contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.huge, gap: SPACE.md }}).
 *     - Forms: avoidKeyboard (iOS) and the submit button in `footer`.
 *  2. Exactly one header: AppHeader (every stack screen) OR Hero under a slim
 *     AppHeader (dashboards). AppHeader already pads SPACE.lg — don't wrap it.
 *  3. Horizontal gutter is ALWAYS SPACE.lg (16). Components that sit on the
 *     gutter themselves: Hero, SectionTitle, Section, StatGrid, Notice,
 *     SegmentedTabs, FilterChips, SkeletonList. A bare Card does NOT — give it
 *     `style={{ marginHorizontal: SPACE.lg }}` or put it in a Section.
 *  4. Vertical rhythm (4-pt grid):
 *       SPACE.xs 4   icon↔text inside a control
 *       SPACE.sm 8   label↔value, chip↔chip
 *       SPACE.md 12  card↔card, field↔field, list item gap
 *       SPACE.lg 16  card padding, screen gutter, header↔first block
 *       SPACE.xl 20  section↔section (SectionTitle already adds marginTop xl)
 *       SPACE.xxl 28 / huge 48 — before a footer, empty-state padding
 *  5. Radii: RADIUS.lg (16) cards · RADIUS.xl (24) hero/sheets · RADIUS.md (12)
 *     fields, inner tiles, icon chips · RADIUS.pill buttons/chips/badges.
 *  6. Elevation: Card = SHADOW.card + 1px border. Only Hero uses SHADOW.lifted.
 *     Never shadow + overflow:'hidden' on one view (iOS drops the shadow).
 *  7. Type: TYPE.display (hero numbers) · title (screen title, 20) · heading
 *     (card/section titles, 16) · subheading (15) · body (14) · bodyStrong ·
 *     label (form labels, 13) · caption (meta, 12) · eyebrow (UPPERCASE 11) ·
 *     number (stats/amounts, tabular). Don't invent sizes.
 *  8. Touch: everything tappable >= 44px (SIZE.touch). Buttons 48 (SIZE.control).
 *     Give icon-only buttons an accessibilityLabel.
 *
 * ---------------------------------------------------------------- WHICH COMPONENT
 *
 *   Page title + back ............ AppHeader (onBack, right = 1-2 IconButton)
 *   Dashboard / detail top ....... Hero (eyebrow, title, subtitle, icon|right, children = chips/buttons)
 *   Group heading ................ SectionTitle (action + onAction for "View all") / Section
 *   Container .................... Card (variant elevated | outlined | tinted; onPress = pressable)
 *   Navigation / menu item ....... ListRow inside <Card padded={false} style={{paddingHorizontal: SPACE.lg}}>
 *                                  (last on the final row; leading={<Avatar/>} for people)
 *   Read-only detail ............. InfoRow (stacked) or InfoRow inline (short values);
 *                                  compact summary → KeyValueGrid
 *   Setting on/off ............... ToggleRow
 *   Metrics ...................... StatGrid (columns 2|3) of StatTile
 *   Status ....................... Badge status="…" (any server spelling; statusTone maps it)
 *   Pick one of <= 4 ............. SegmentedTabs (equal width, fits 360dp)
 *   Pick one of 5+ / long labels . FilterChips (or SegmentedTabs scrollable)
 *   Tag / filter toggle .......... Chip (FilterChip)
 *   Main action .................. PrimaryButton (one per view) — in BottomActionBar when it
 *                                  finishes the screen (submit, pay, save)
 *   Second action ................ SecondaryButton (soft fill) or PrimaryButton variant="outline"
 *   Tertiary / text action ....... GhostButton
 *   Destructive .................. DangerButton (outline for reversible)
 *   Text input ................... Field (label, required, hint, error, icon, right, multiline)
 *   First load ................... SkeletonList (lists) or Loading (whole screen)
 *   Nothing to show .............. EmptyState (icon, title, message, action)
 *   Request failed ............... ErrorState onRetry
 *   Inline message ............... Notice kind info|warning|success|danger (title optional)
 *   Person ....................... Avatar (name, uri → photo with initials fallback)
 *   Separator .................... Divider (inset to align under row text) / Spacer
 *
 * Never: a raw <Modal transparent> inside a tab (Rule 2 — use an inline card or
 * a Stack screen); a component declared inside another component; a list
 * without the FlatList props above.
 *
 * ---------------------------------------------------------------- PREMIUM LAYER (src/ui/premium)
 *
 * The brand look (sign-in, registration; rolling out to every screen):
 *
 *   <PremiumScreen tone header={…}>                gradient header + animated waves, light status bar
 *     header: <BrandLogo/> <GlassBadge/> <PremiumHeading eyebrow title subtitle/>
 *             <FloatingIllustration source={ILLUSTRATIONS.clipboard}/>  (or children = <MapPin3D/>)
 *             <PremiumStepper step labels/>        (multi-step forms, white on the gradient)
 *             <GlassIconButton icon="arrow-back"/> (back on the gradient)
 *     body:   <FadeInUp style={{ marginTop: -PREMIUM_OVERLAP }}>
 *               <PremiumSheet>…</PremiumSheet>     (auth forms)  or  <PremiumSection>…</PremiumSection> (long forms)
 *             </FadeInUp>
 *   </PremiumScreen>
 *
 *   Inputs ....... PremiumInput (= Field props + prefix chip), PremiumSelect (= SelectField props)
 *   Buttons ...... GradientButton (primary | outline | glass), PremiumFooter (Back + primary)
 *   Social ....... SocialPill       Divider ....... PremiumDivider
 *   Person ....... GradientAvatar (gradient ring + photo/initials + status dot)
 *   Motion ....... FadeInUp (stagger with delay 60–80ms), PressableScale (0.97 spring),
 *                  useLoop, useReduceMotion — native driver only, off under reduce-motion.
 *   Backdrop ..... BrandBackdrop / WaveHeader on its own for a shorter inner-screen header.
 *
 * Member = navy→blue, business = violet, admin = deep indigo (premiumTone). Never purple on the member side.
 */
export * from './tokens';
export * from './AppTheme';
export * from './AppearancePicker';
export * from './components';
export * from './data';
export * from './premium';
export * from './FitImage';
