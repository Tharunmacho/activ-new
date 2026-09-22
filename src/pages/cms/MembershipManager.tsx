import { useCallback, useEffect, useState } from 'react';
import {
    CmsPage, CmsSteps, CmsStep, CmsSection, CmsField, CmsInput, CmsTextarea,
    CmsLoading, CmsError, SaveNowProvider, SectionToolsProvider, cmsSaved, cmsFailed,
} from './components/CmsUI';
import { LineList, IconPicker, ExtraFieldsEditor, RepeatableList } from './components/CmsEditors';
import RichTextEditor from './components/RichTextEditor';
import { errorMessage } from '@/services/api';
import {
    getMembership, saveMembership, EMPTY_MEMBERSHIP,
    type MembershipContent, type MembershipAdvantage, type MembershipStep,
} from '@/services/cmsMembershipApi';

/**
 * ============================================================================
 * THE MEMBERSHIP PROSPECTUS — "ACTIV Membership Advantage"
 * ============================================================================
 *
 * This document lived in the bundle as a typed table, and the note on it said
 * why: a fixed twelve-page prospectus with a shape no generic editor
 * expresses. It also said what to build when the association wanted to revise
 * it themselves — "a CMS document shaped like `ADVANTAGES`, not a looser one".
 *
 * So this screen is not a rich-text box with the whole document in it. Each
 * part of the page is the card it is on the page:
 *
 *   1  the opening        the eyebrow, the title, the two-part heading
 *   2  why join           a heading, a lead-in and a list
 *   3  the advantages     fifteen cards, each with its own list
 *   4  the journey        seven steps
 *   5  who should join    a list
 *   6  why it matters     eight cards
 *   7  the closing        eleven fields, every one on the page
 *
 * AN ADVANTAGE IS A CARD, not a row in a table, because it holds paragraphs
 * above a list, the list, an emphasised one-liner and paragraphs below it —
 * and an editor needs to see which of those they are typing into.
 *
 * `slug` is the anchor a `#link` points at. It is editable and it should be
 * changed rarely: a link somebody has sent stops working when it moves.
 */

const blankAdvantage = (): MembershipAdvantage => ({
    slug: '', number: '', icon: 'award', title: '', subtitle: '',
    body: [], listLead: '', bullets: [], closing: '', after: [],
});

const blankStep = (): MembershipStep => ({ step: '', icon: 'circle-check', title: '', text: '' });

export default function MembershipManager() {
    const [copy, setCopy] = useState<MembershipContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const doc = await getMembership();
            /* A document nobody has written yet answers with empty fields, and
               the editor opens on them — which is how a new one is started. */
            setCopy(doc || { ...EMPTY_MEMBERSHIP });
        } catch (err) {
            setError(errorMessage(err, 'The prospectus could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!copy) return;
        setSaving(true);
        try {
            setCopy(await saveMembership(copy));
            setDirty(false);
            cmsSaved('Membership page');
        } catch (err) {
            cmsFailed('Membership page', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CmsPage><CmsLoading label="Loading the prospectus…" /></CmsPage>;
    if (error || !copy) {
        return <CmsPage><CmsError message={error || 'No content'} onRetry={load} /></CmsPage>;
    }

    const set = (patch: Partial<MembershipContent>) => {
        setCopy({ ...copy, ...patch });
        setDirty(true);
    };

    /* Removing a card, or adding a field to one — see `SectionToolsProvider`. */
    const setSections = (sections: MembershipContent['sections']) => set({ sections });

    return (
        <SaveNowProvider value={{ save, saving, dirty }}>
            <CmsPage>
                <SectionToolsProvider value={{ sections: copy.sections || [], onChange: setSections }}>
                <CmsSteps>
                    {/* ------------------------------------------ 1. opening */}
                    <CmsStep
                        sectionKey="membership.opening"
                        step="Section 1"
                        title="The opening"
                        hint="The band at the top of /membership, and the heading under it."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Small label">
                                <CmsInput
                                    value={copy.eyebrow}
                                    onChange={(e) => set({ eyebrow: e.target.value })}
                                    placeholder="Membership"
                                />
                            </CmsField>
                            <CmsField label="Title" hint="Also the browser tab.">
                                <CmsInput
                                    value={copy.title}
                                    onChange={(e) => set({ title: e.target.value })}
                                    placeholder="ACTIV Membership Advantage"
                                />
                            </CmsField>
                        </div>

                        <CmsField label="Tagline" hint="The line under the title in the band.">
                            <CmsInput
                                value={copy.tagline}
                                onChange={(e) => set({ tagline: e.target.value })}
                                placeholder="Join ACTIV — Connect. Grow. Compete. Create Wealth."
                            />
                        </CmsField>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField
                                label="Heading, first clause"
                                hint="Set in near-black. Two fields, not one, so the layout is not decided by where a full stop happens to fall."
                            >
                                <CmsInput
                                    value={copy.subtitleLead}
                                    onChange={(e) => set({ subtitleLead: e.target.value })}
                                    placeholder="Your Membership."
                                />
                            </CmsField>
                            <CmsField label="Heading, the rest" hint="Set in the brand colour.">
                                <CmsInput
                                    value={copy.subtitleRest}
                                    onChange={(e) => set({ subtitleRest: e.target.value })}
                                    placeholder="Your Network. Your Growth Platform."
                                />
                            </CmsField>
                        </div>

                        <LineList
                            label="Introduction"
                            hint="One paragraph per line."
                            value={copy.body}
                            onChange={(body) => set({ body })}
                            rows={6}
                        />
                    </CmsStep>

                    {/* ----------------------------------------- 2. why join */}
                    <CmsStep
                        sectionKey="membership.why"
                        step="Section 2"
                        title="Why join"
                        hint="The card beside the introduction."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={copy.whyJoin.heading}
                                    onChange={(e) => set({
                                        whyJoin: { ...copy.whyJoin, heading: e.target.value },
                                    })}
                                    placeholder="Why Join ACTIV?"
                                />
                            </CmsField>
                            <CmsField label="Sub-heading">
                                <CmsInput
                                    value={copy.whyJoin.subtitle}
                                    onChange={(e) => set({
                                        whyJoin: { ...copy.whyJoin, subtitle: e.target.value },
                                    })}
                                />
                            </CmsField>
                        </div>

                        <CmsField label="Lead-in" hint="The sentence above the list.">
                            <CmsInput
                                value={copy.whyJoin.lead}
                                onChange={(e) => set({
                                    whyJoin: { ...copy.whyJoin, lead: e.target.value },
                                })}
                                placeholder="ACTIV membership provides a platform to:"
                            />
                        </CmsField>

                        <LineList
                            label="The list"
                            hint="One per line."
                            value={copy.whyJoin.bullets}
                            onChange={(bullets) => set({ whyJoin: { ...copy.whyJoin, bullets } })}
                            rows={8}
                        />
                    </CmsStep>

                    {/* --------------------------------------- 3. advantages */}
                    <CmsStep
                        sectionKey="membership.advantages"
                        step="Section 3"
                        title="The advantages"
                        hint="One card each, in this order. The number is printed as typed rather than counted, so a card can be reordered without renumbering the document."
                    >
                        <RepeatableList<MembershipAdvantage>
                            items={copy.advantages}
                            onChange={(advantages) => set({ advantages })}
                            noun="advantage"
                            blank={blankAdvantage}
                            summary={(a) => ({
                                title: [a.number, a.title].filter(Boolean).join('  '),
                                subtitle: a.subtitle || `${a.bullets.length} points`,
                            })}
                            row={(item, update) => (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-[110px_200px_1fr]">
                                        <CmsField label="Number">
                                            <CmsInput
                                                value={item.number}
                                                onChange={(e) => update({ number: e.target.value })}
                                                placeholder="01"
                                            />
                                        </CmsField>
                                        <IconPicker
                                            value={item.icon}
                                            onChange={(icon) => update({ icon })}
                                        />
                                        <CmsField label="Title">
                                            <CmsInput
                                                value={item.title}
                                                onChange={(e) => update({ title: e.target.value })}
                                                placeholder="Business Networking"
                                            />
                                        </CmsField>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <CmsField label="Sub-heading">
                                            <CmsInput
                                                value={item.subtitle}
                                                onChange={(e) => update({ subtitle: e.target.value })}
                                            />
                                        </CmsField>
                                        <CmsField
                                            label="Anchor"
                                            hint="The #link that opens this card. Change it rarely — a link somebody has sent stops working."
                                        >
                                            <CmsInput
                                                value={item.slug}
                                                onChange={(e) => update({ slug: e.target.value })}
                                                placeholder="business-networking"
                                            />
                                        </CmsField>
                                    </div>

                                    <LineList
                                        label="Paragraphs above the list"
                                        hint="One per line. The first is the teaser shown while the card is shut."
                                        value={item.body}
                                        onChange={(body) => update({ body })}
                                        rows={3}
                                    />

                                    <CmsField label="Lead-in" hint="The sentence introducing the list.">
                                        <CmsInput
                                            value={item.listLead}
                                            onChange={(e) => update({ listLead: e.target.value })}
                                        />
                                    </CmsField>

                                    <LineList
                                        label="The list"
                                        value={item.bullets}
                                        onChange={(bullets) => update({ bullets })}
                                        rows={6}
                                    />

                                    <CmsField
                                        label="The emphasised line"
                                        hint="Set apart under the list. Drawn before the paragraphs below."
                                    >
                                        <RichTextEditor
                                            rows={2}
                                            value={item.closing}
                                            onChange={(closing) => update({ closing })}
                                        />
                                    </CmsField>

                                    <LineList
                                        label="Paragraphs below"
                                        value={item.after}
                                        onChange={(after) => update({ after })}
                                        rows={3}
                                    />
                                </div>
                            )}
                        />
                    </CmsStep>

                    {/* ------------------------------------------ 4. journey */}
                    <CmsStep
                        sectionKey="membership.journey"
                        step="Section 4"
                        title="The journey"
                        hint="The dark band of numbered steps."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Small label">
                                <CmsInput
                                    value={copy.journeyEyebrow}
                                    onChange={(e) => set({ journeyEyebrow: e.target.value })}
                                    placeholder="Seven steps"
                                />
                            </CmsField>
                            <CmsField label="Heading">
                                <CmsInput
                                    value={copy.journeyHeading}
                                    onChange={(e) => set({ journeyHeading: e.target.value })}
                                    placeholder="The ACTIV Membership Journey"
                                />
                            </CmsField>
                        </div>

                        <RepeatableList<MembershipStep>
                            items={copy.journey}
                            onChange={(journey) => set({ journey })}
                            noun="step"
                            blank={blankStep}
                            summary={(j) => ({
                                title: [j.step, j.title].filter(Boolean).join('  '),
                                subtitle: j.text,
                            })}
                            row={(item, update) => (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-[110px_200px_1fr]">
                                        <CmsField label="Number">
                                            <CmsInput
                                                value={item.step}
                                                onChange={(e) => update({ step: e.target.value })}
                                                placeholder="01"
                                            />
                                        </CmsField>
                                        <IconPicker
                                            value={item.icon}
                                            onChange={(icon) => update({ icon })}
                                        />
                                        <CmsField label="Title">
                                            <CmsInput
                                                value={item.title}
                                                onChange={(e) => update({ title: e.target.value })}
                                            />
                                        </CmsField>
                                    </div>
                                    <CmsField label="Text">
                                        <CmsTextarea
                                            rows={3}
                                            value={item.text}
                                            onChange={(e) => update({ text: e.target.value })}
                                        />
                                    </CmsField>
                                </div>
                            )}
                        />
                    </CmsStep>

                    {/* ----------------------------------- 5. who should join */}
                    <CmsStep
                        sectionKey="membership.who"
                        step="Section 5"
                        title="Who should join"
                        hint="The list of who the membership is for."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={copy.whoShouldJoin.heading}
                                    onChange={(e) => set({
                                        whoShouldJoin: { ...copy.whoShouldJoin, heading: e.target.value },
                                    })}
                                    placeholder="Who Should Join ACTIV?"
                                />
                            </CmsField>
                            <CmsField label="Lead-in">
                                <CmsInput
                                    value={copy.whoShouldJoin.lead}
                                    onChange={(e) => set({
                                        whoShouldJoin: { ...copy.whoShouldJoin, lead: e.target.value },
                                    })}
                                    placeholder="ACTIV membership is suitable for:"
                                />
                            </CmsField>
                        </div>

                        <LineList
                            label="The list"
                            hint="One per line."
                            value={copy.whoShouldJoin.bullets}
                            onChange={(bullets) => set({
                                whoShouldJoin: { ...copy.whoShouldJoin, bullets },
                            })}
                            rows={10}
                        />
                    </CmsStep>

                    {/* ------------------------------------ 6. why it matters */}
                    <CmsStep
                        sectionKey="membership.matters"
                        step="Section 6"
                        title="Why it matters"
                        hint="The grid of short cards near the foot of the page."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={copy.mattersHeading}
                                    onChange={(e) => set({ mattersHeading: e.target.value })}
                                    placeholder="Why ACTIV Membership Matters"
                                />
                            </CmsField>
                            <CmsField label="Sub-heading">
                                <CmsInput
                                    value={copy.mattersSubtitle}
                                    onChange={(e) => set({ mattersSubtitle: e.target.value })}
                                    placeholder="One Membership. Multiple Possibilities."
                                />
                            </CmsField>
                        </div>

                        <RepeatableList<MembershipStep>
                            items={copy.whyItMatters}
                            onChange={(whyItMatters) => set({ whyItMatters })}
                            noun="card"
                            blank={blankStep}
                            summary={(m) => ({ title: m.title, subtitle: m.text })}
                            row={(item, update) => (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                                        <IconPicker
                                            value={item.icon}
                                            onChange={(icon) => update({ icon })}
                                        />
                                        <CmsField label="Title">
                                            <CmsInput
                                                value={item.title}
                                                onChange={(e) => update({ title: e.target.value })}
                                            />
                                        </CmsField>
                                    </div>
                                    <CmsField label="Text">
                                        <CmsTextarea
                                            rows={3}
                                            value={item.text}
                                            onChange={(e) => update({ text: e.target.value })}
                                        />
                                    </CmsField>
                                </div>
                            )}
                        />
                    </CmsStep>

                    {/* ------------------------------------------ 7. closing */}
                    <CmsStep
                        sectionKey="membership.closing"
                        step="Section 7"
                        title="The closing"
                        hint="The last band — the call to join and how to enquire."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading, first clause">
                                <CmsInput
                                    value={copy.closingHeading}
                                    onChange={(e) => set({ closingHeading: e.target.value })}
                                    placeholder="Be More Than a Business Owner."
                                />
                            </CmsField>
                            <CmsField label="Heading, the rest" hint="Set in the accent colour.">
                                <CmsInput
                                    value={copy.closingHeadingHighlight}
                                    onChange={(e) => set({ closingHeadingHighlight: e.target.value })}
                                    placeholder="Be Part of a Business Community."
                                />
                            </CmsField>
                        </div>

                        <LineList
                            label="The couplet"
                            hint="Two short lines, one per line."
                            value={copy.closingBody}
                            onChange={(closingBody) => set({ closingBody })}
                            rows={3}
                        />

                        <CmsField label="Note" hint="The paragraph under the couplet.">
                            <CmsTextarea
                                rows={2}
                                value={copy.closingNote}
                                onChange={(e) => set({ closingNote: e.target.value })}
                            />
                        </CmsField>

                        <CmsField label="Statement" hint="What the association is, in one sentence.">
                            <CmsTextarea
                                rows={2}
                                value={copy.statement}
                                onChange={(e) => set({ statement: e.target.value })}
                            />
                        </CmsField>

                        <CmsSection title="The call" hint="The block that asks the reader to join.">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={copy.callHeading}
                                    onChange={(e) => set({ callHeading: e.target.value })}
                                    placeholder="Join ACTIV Today"
                                />
                            </CmsField>

                            <LineList
                                label="Lines"
                                hint="One per line, each set on its own."
                                value={copy.callLines}
                                onChange={(callLines) => set({ callLines })}
                                rows={6}
                            />

                            <CmsField label="Invitation" hint="The sentence under the lines.">
                                <CmsInput
                                    value={copy.invitation}
                                    onChange={(e) => set({ invitation: e.target.value })}
                                />
                            </CmsField>
                        </CmsSection>

                        <CmsSection title="Enquiries" hint="The two ways to get in touch, at the very bottom.">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <CmsField label="Heading">
                                    <CmsInput
                                        value={copy.enquiriesHeading}
                                        onChange={(e) => set({ enquiriesHeading: e.target.value })}
                                        placeholder="Membership Enquiries"
                                    />
                                </CmsField>
                                <CmsField label="Website" hint="Without https:// — the page adds it.">
                                    <CmsInput
                                        value={copy.website}
                                        onChange={(e) => set({ website: e.target.value })}
                                        placeholder="www.activ.org.in"
                                    />
                                </CmsField>
                                <CmsField label="Email">
                                    <CmsInput
                                        value={copy.email}
                                        onChange={(e) => set({ email: e.target.value })}
                                        placeholder="info@activ.org.in"
                                    />
                                </CmsField>
                            </div>
                        </CmsSection>

                        {/* `bare`: this section already carries the heading. */}
                        <CmsSection
                            title="Your own fields"
                            hint="Anything else this page should record that the fields above do not cover."
                        >
                            <ExtraFieldsEditor
                                bare
                                items={copy.extraFields}
                                onChange={(extraFields) => set({ extraFields })}
                            />
                        </CmsSection>
                    </CmsStep>
                </CmsSteps>
                </SectionToolsProvider>
            </CmsPage>
        </SaveNowProvider>
    );
}
