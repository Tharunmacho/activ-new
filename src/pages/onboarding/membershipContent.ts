import {
    Award, BookOpen, CalendarDays, ClipboardList, Coins, Eye, Globe,
    GraduationCap, Handshake, HeartHandshake, KeyRound, Landmark, Network,
    Newspaper, Presentation, Rocket, Store, TrendingUp, UserCheck, Users,
    type LucideIcon,
} from 'lucide-react';

/**
 * "ACTIV Membership Advantage" — the association's membership prospectus,
 * verbatim.
 *
 * =========================================================================
 * WHY THIS IS A TABLE IN THE BUNDLE AND NOT A CMS DOCUMENT
 * =========================================================================
 *
 * Every other long-form page on this site reads from the CMS, and the reason
 * is a good one: wording changes should not need a deploy. This one does not,
 * and the difference is what the text IS. The legal notices, the About block
 * and the events programme are copy an editor revises. This is a fixed
 * twelve-page prospectus the association approved as a document — fifteen
 * numbered advantages, a seven-step journey and a closing call, each with its
 * own shape — and there is no editor screen in the CMS that can express that
 * structure. Modelling it there would mean either a new schema per section
 * type, or flattening it to headings and bullets and losing the shape.
 *
 * So it lives here, typed, and the structure is enforced by the compiler
 * rather than by an editor remembering the convention. If the association ever
 * wants to revise this copy themselves, the move is a CMS document shaped like
 * `ADVANTAGES` below — not a looser one.
 *
 * NOTHING HERE IS PARAPHRASED. The sentences, their order, the lead-in line
 * above each list and the emphasised one-liner that closes several of the
 * sections are the document's own. The only edits are typographic: the PDF's
 * double hyphens are em dashes and its hyphenated pairs ("Buyer-seller") are
 * en dashes, because that is what the rest of the site uses.
 */

/** A paragraph that is set apart — the document's own emphasised one-liners. */
export interface Advantage {
    /** The anchor, so the contents list at the top of the page can reach it. */
    id: string;
    /** "01" … "15", printed as drawn. */
    number: string;
    icon: LucideIcon;
    title: string;
    /** The line under the title — the section's own sub-heading. */
    subtitle: string;
    /** Paragraphs above the list. */
    body: string[];
    /** The sentence that introduces the list. Empty when the section has none. */
    listLead: string;
    bullets: string[];
    /**
     * The emphasised one-liner. Rendered BEFORE `after`, because section 6 —
     * the only section carrying both — has it in that order in the document.
     */
    closing: string;
    /** Paragraphs below the list. */
    after: string[];
}

// ============================================================ the opening

export const MEMBERSHIP_INTRO = {
    eyebrow: 'Membership',
    title: 'ACTIV Membership Advantage',
    tagline: 'Join ACTIV — Connect. Grow. Compete. Create Wealth.',
    /**
     * "Your Membership. Your Network. Your Growth Platform."
     *
     * Split in two because it is set as the opening section's heading, in the
     * About page's treatment — first clause in near-black, the rest in
     * `brand-600`. Splitting it here rather than in the page keeps the page
     * free of copy: a `.split('.')` in the JSX would be this sentence's
     * punctuation deciding the layout.
     */
    subtitleLead: 'Your Membership.',
    subtitleRest: 'Your Network. Your Growth Platform.',
    body: [
        'ACTIV — Adidravidar Confederation of Trade and Industrial Vision — is a chamber of commerce and entrepreneurship development platform working to strengthen SC/ST and Women Entrepreneurs by creating opportunities for business networking, market access, knowledge sharing, government engagement, capacity building and wealth creation.',
        'As an ACTIV Member, you become part of a growing entrepreneurial network that connects Micro, Small and Emerging Entrepreneurs, Traders, Manufacturers, Service Providers, Startups, Professionals, Institutions and Industry Stakeholders.',
        'Membership is more than an association. It is an opportunity to build relationships, access information, discover markets, improve competitiveness and participate in the larger business ecosystem.',
    ],
};

export const WHY_JOIN = {
    heading: 'Why Join ACTIV?',
    subtitle: 'Build Your Business. Expand Your Network. Unlock Opportunities.',
    lead: 'ACTIV membership provides a platform to:',
    bullets: [
        'Connect with entrepreneurs and business leaders',
        'Develop valuable business relationships',
        'Discover new markets and business opportunities',
        'Participate in business meetings, seminars and conferences',
        'Understand Government schemes, policies and programmes',
        'Improve business knowledge and professional capabilities',
        'Explore vendor and procurement opportunities',
        'Participate in exhibitions and networking programmes',
        'Strengthen your digital and business presence',
        'Represent entrepreneurial concerns through a collective platform',
        'Learn from experienced entrepreneurs, professionals and industry experts',
        'Collaborate with other members for business growth',
    ],
};

// ================================================= the fifteen advantages

export const ADVANTAGES: Advantage[] = [
    {
        id: 'business-networking',
        number: '01',
        icon: Network,
        title: 'Business Networking',
        subtitle: 'Connect With the Right People',
        body: [
            'Business growth is strongly influenced by the quality of your network. ACTIV provides opportunities for members to connect with entrepreneurs, institutions, industry representatives and Government stakeholders.',
        ],
        listLead: 'Members can benefit from:',
        bullets: [
            'Entrepreneur-to-entrepreneur networking',
            'Business networking meetings',
            'Interaction with industry leaders and experts',
            'Connections with institutions and business organisations',
            'State and Central Government interaction platforms',
            'Business referral and collaboration opportunities',
            'Participation in business forums and entrepreneurial communities',
            'Opportunities to build strategic partnerships and alliances',
        ],
        closing: 'Your Network Can Become Your Growth Engine.',
        after: [],
    },
    {
        id: 'market-access',
        number: '02',
        icon: Store,
        title: 'Business Opportunities & Market Access',
        subtitle: 'Discover New Markets. Build New Business Relationships.',
        body: [
            'ACTIV works to create platforms where entrepreneurs can identify new business possibilities and expand beyond their existing markets.',
        ],
        listLead: 'Membership opportunities may include:',
        bullets: [
            'B2B networking',
            'Buyer–seller meetings',
            'Vendor development programmes',
            'PSU and corporate interaction programmes',
            'Business opportunity meetings',
            'Exhibitions and trade events',
            'Product and service showcases',
            'Business delegation programmes',
            'Market linkage initiatives',
            'Collaboration and partnership opportunities',
        ],
        closing: '',
        after: [
            'Whether you are looking for customers, suppliers, distributors, vendors, partners or new markets, ACTIV provides a platform to connect and explore.',
        ],
    },
    {
        id: 'government-connect',
        number: '03',
        icon: Landmark,
        title: 'Government & Policy Connect',
        subtitle: 'Stay Connected With the Government Ecosystem',
        body: [
            'Government policies, schemes, procurement programmes and regulations have a significant impact on MSMEs and entrepreneurs.',
            'ACTIV provides platforms for members to understand relevant Government initiatives and participate in discussions concerning entrepreneurship and enterprise development.',
        ],
        listLead: 'Members can gain access to:',
        bullets: [
            'Awareness programmes on Government schemes',
            'MSME-related policy discussions',
            'Entrepreneurship development initiatives',
            'Government department interaction programmes',
            'Procurement and tender awareness',
            'SC/ST entrepreneurship development initiatives',
            'Women entrepreneurship programmes',
            'Policy and regulatory awareness sessions',
            'Opportunities to raise common business concerns through a collective platform',
        ],
        closing: 'Understand the System. Navigate Opportunities. Grow With Confidence.',
        after: [],
    },
    {
        id: 'knowledge',
        number: '04',
        icon: GraduationCap,
        title: 'Knowledge & Business Education',
        subtitle: 'Learn. Upgrade. Apply.',
        body: [
            'Successful entrepreneurs continuously upgrade their knowledge.',
            'ACTIV conducts and facilitates seminars, workshops, webinars, conferences, training programmes, expert sessions and knowledge-sharing events covering practical business topics.',
        ],
        listLead: 'Members can benefit from programmes related to:',
        bullets: [
            'Entrepreneurship development',
            'Business management',
            'Finance and taxation',
            'Digital transformation',
            'Marketing and branding',
            'Sales development',
            'E-commerce',
            'Government procurement',
            'GeM and tender opportunities',
            'Export and international business',
            'Business compliance',
            'Technology adoption',
            'Productivity and quality improvement',
            'Startup development',
            'Financial literacy',
            'Leadership and professional development',
        ],
        closing: 'Knowledge That Can Be Applied to Business.',
        after: [],
    },
    {
        id: 'msme-competitiveness',
        number: '05',
        icon: TrendingUp,
        title: 'MSME Competitiveness',
        subtitle: 'Make Your Enterprise Stronger and More Competitive',
        body: [
            'ACTIV aims to help entrepreneurs move from survival to sustainability, from sustainability to growth, and from growth to wealth creation.',
        ],
        listLead: 'Members can gain exposure to:',
        bullets: [
            'Business improvement practices',
            'Capacity-building programmes',
            'Expert consultations',
            'Technology awareness',
            'Digital business solutions',
            'Productivity improvement',
            'Quality and process improvement',
            'Financial management awareness',
            'Marketing strategies',
            'Business planning',
            'Professional networking',
        ],
        closing: '',
        after: [
            'ACTIV also works with institutions, experts, corporates and ecosystem partners to create programmes that support the development of entrepreneurial capabilities.',
        ],
    },
    {
        id: 'procurement',
        number: '06',
        icon: ClipboardList,
        title: 'Procurement & Vendor Development',
        subtitle: 'Become Ready for Larger Business Opportunities',
        body: [
            'Government departments, PSUs and large corporations offer significant opportunities for MSMEs.',
        ],
        listLead: 'ACTIV creates awareness and networking platforms around:',
        bullets: [
            'Government procurement',
            'PSU vendor opportunities',
            'Corporate vendor development',
            'Tender participation',
            'GeM awareness',
            'MSME procurement opportunities',
            'SC/ST enterprise participation',
            'Buyer–seller interactions',
            'Vendor registration awareness',
            'Business documentation and readiness',
        ],
        closing: 'From Local Enterprise to Institutional Supplier.',
        after: [
            'ACTIV seeks to help members understand the requirements and build the capabilities needed to pursue larger procurement opportunities.',
        ],
    },
    {
        id: 'exhibitions',
        number: '07',
        icon: Presentation,
        title: 'Exhibitions & Business Events',
        subtitle: 'Showcase Your Enterprise',
        body: [
            'Visibility matters.',
            'ACTIV provides members with opportunities to participate in:',
        ],
        listLead: '',
        bullets: [
            'Business exhibitions',
            'Trade fairs',
            'Product showcases',
            'Entrepreneurial conferences',
            'Networking events',
            'Startup programmes',
            'Pitch and presentation programmes',
            'Buyer–seller meetings',
            'Business delegation programmes',
            'Industry interaction events',
        ],
        closing: '',
        after: [
            'These platforms can help members showcase products, meet prospective customers, identify partners and increase market visibility.',
        ],
    },
    {
        id: 'digital-visibility',
        number: '08',
        icon: Globe,
        title: 'Digital Business & Brand Visibility',
        subtitle: 'Take Your Business to the Digital Marketplace',
        body: [
            'In today’s economy, a strong digital presence is an important part of business development.',
            'ACTIV promotes awareness and opportunities relating to:',
        ],
        listLead: '',
        bullets: [
            'Digital business presence',
            'Website development',
            'Google Business Profile',
            'Social media presence',
            'Digital marketing',
            'E-commerce',
            'Online customer acquisition',
            'Digital networking',
            'Business branding',
            'Professional online visibility',
        ],
        closing: '',
        after: [
            'Members can participate in programmes designed to help traditional businesses and emerging enterprises understand and adopt digital tools.',
        ],
    },
    {
        id: 'business-intelligence',
        number: '09',
        icon: Newspaper,
        title: 'Information & Business Intelligence',
        subtitle: 'Information That Helps You Make Better Decisions',
        body: [
            'Entrepreneurs need timely and relevant information to identify opportunities and manage risks.',
            'ACTIV programmes and communication channels can provide awareness and information relating to:',
        ],
        listLead: '',
        bullets: [
            'Government notifications',
            'MSME schemes',
            'Business policies',
            'Tender opportunities',
            'Procurement programmes',
            'Entrepreneurship programmes',
            'Training opportunities',
            'Funding and finance awareness',
            'Market opportunities',
            'Industry developments',
            'Trade events',
            'Business networking opportunities',
        ],
        closing: 'Stay Informed. Stay Prepared. Stay Competitive.',
        after: [],
    },
    {
        id: 'mentorship',
        number: '10',
        icon: UserCheck,
        title: 'Expert Access & Mentorship',
        subtitle: 'Learn From Experience',
        body: [
            'Entrepreneurs often face challenges that cannot be solved through information alone.',
            'ACTIV provides platforms to interact with:',
        ],
        listLead: '',
        bullets: [
            'Successful entrepreneurs',
            'Industry professionals',
            'Business consultants',
            'Finance professionals',
            'Government officials',
            'Technology experts',
            'Marketing specialists',
            'Export professionals',
            'Institutional representatives',
            'Subject-matter experts',
        ],
        closing: '',
        after: [
            'Members can gain practical perspectives, ask questions and learn from real-world entrepreneurial experiences.',
        ],
    },
    {
        id: 'startup-development',
        number: '11',
        icon: Rocket,
        title: 'Startup & Entrepreneur Development',
        subtitle: 'From Idea to Enterprise',
        body: [
            'ACTIV encourages aspiring entrepreneurs and emerging businesses to participate in entrepreneurship development initiatives.',
        ],
        listLead: 'Opportunities may include:',
        bullets: [
            'Startup awareness programmes',
            'Entrepreneurial orientation',
            'Business idea discussions',
            'Pitch sessions',
            'Expert interactions',
            'Business networking',
            'Mentorship opportunities',
            'Market linkage',
            'Funding awareness',
            'Business development programmes',
        ],
        closing: 'Build the Confidence to Start. Build the Capability to Grow.',
        after: [],
    },
    {
        id: 'empowerment',
        number: '12',
        icon: HeartHandshake,
        title: 'SC/ST & Women Entrepreneur Empowerment',
        subtitle: 'Creating Greater Economic Participation',
        body: [
            'ACTIV places special emphasis on expanding economic opportunities for SC/ST and Women Entrepreneurs.',
            'Through networking, awareness, capacity building and market-oriented programmes, ACTIV seeks to encourage greater participation in:',
        ],
        listLead: '',
        bullets: [
            'Entrepreneurship',
            'Manufacturing',
            'Trading',
            'Services',
            'Government procurement',
            'Corporate supply chains',
            'Startups',
            'Digital commerce',
            'Export opportunities',
            'Institutional business networks',
        ],
        closing: 'Economic Empowerment Begins With Economic Opportunity.',
        after: [],
    },
    {
        id: 'collaboration',
        number: '13',
        icon: Handshake,
        title: 'Collaboration & Partnerships',
        subtitle: 'Grow Through Collaboration',
        body: [
            'No enterprise grows in isolation.',
            'ACTIV creates opportunities for members to connect and collaborate with:',
        ],
        listLead: '',
        bullets: [
            'Industry associations',
            'Chambers of Commerce',
            'Government departments',
            'Public Sector Undertakings',
            'Corporates',
            'Financial institutions',
            'Educational institutions',
            'Entrepreneurship development organisations',
            'Professional organisations',
            'Technology and service providers',
            'Other business networks',
        ],
        closing: '',
        after: [
            'Such relationships can open doors to knowledge, partnerships, markets and new business possibilities.',
        ],
    },
    {
        id: 'community-development',
        number: '14',
        icon: Users,
        title: 'Social & Community Development',
        subtitle: 'Business With a Larger Purpose',
        body: [
            'ACTIV believes that entrepreneurship can contribute to broader economic and social development.',
            'Members can participate in initiatives related to:',
        ],
        listLead: '',
        bullets: [
            'Entrepreneurship awareness',
            'Skill development',
            'Economic empowerment',
            'Women entrepreneurship',
            'Youth entrepreneurship',
            'Community development',
            'Rural entrepreneurship',
            'Financial and business awareness',
            'Inclusive economic development',
        ],
        closing: 'Build Your Enterprise. Contribute to a Stronger Entrepreneurial Community.',
        after: [],
    },
    {
        id: 'recognition',
        number: '15',
        icon: Award,
        title: 'Member Recognition & Visibility',
        subtitle: 'Let Your Enterprise Be Seen',
        body: [
            'ACTIV provides platforms through which members can increase their professional and business visibility.',
        ],
        listLead: 'Depending on the programme, opportunities may include:',
        bullets: [
            'Member networking profiles',
            'Business introductions',
            'Entrepreneur showcases',
            'Participation in conferences',
            'Exhibition participation',
            'Speaker and expert interaction opportunities',
            'Business success stories',
            'Awards and recognition programmes',
            'Digital and social media visibility',
        ],
        closing: '',
        after: [],
    },
];

// ================================================================ the journey

export const JOURNEY_INTRO = {
    eyebrow: 'Seven steps',
    heading: 'The ACTIV Membership Journey',
};

export interface JourneyStep {
    step: string;
    icon: LucideIcon;
    title: string;
    body: string;
}

export const JOURNEY: JourneyStep[] = [
    {
        step: '01',
        icon: Users,
        title: 'Connect',
        body: 'Become part of a growing entrepreneurial network.',
    },
    {
        step: '02',
        icon: BookOpen,
        title: 'Learn',
        body: 'Gain access to knowledge, experts, programmes and business information.',
    },
    {
        step: '03',
        icon: CalendarDays,
        title: 'Engage',
        body: 'Participate in meetings, seminars, exhibitions, conferences and business forums.',
    },
    {
        step: '04',
        icon: Handshake,
        title: 'Collaborate',
        body: 'Build relationships with entrepreneurs, institutions and business stakeholders.',
    },
    {
        step: '05',
        icon: KeyRound,
        title: 'Access',
        body: 'Explore markets, procurement opportunities, partnerships and Government initiatives.',
    },
    {
        step: '06',
        icon: TrendingUp,
        title: 'Grow',
        body: 'Strengthen your enterprise, competitiveness and market presence.',
    },
    {
        step: '07',
        icon: Coins,
        title: 'Create Wealth',
        body: 'Build a sustainable and growing business for yourself, your family and the wider entrepreneurial community.',
    },
];

// ========================================================== who should join

export const WHO_SHOULD_JOIN = {
    heading: 'Who Should Join ACTIV?',
    lead: 'ACTIV membership is suitable for:',
    items: [
        'Micro Entrepreneurs',
        'Small & Medium Enterprises',
        'Manufacturers',
        'Traders',
        'Service Providers',
        'Women Entrepreneurs',
        'SC/ST Entrepreneurs',
        'Startups',
        'First-generation Entrepreneurs',
        'Exporters & Importers',
        'Professionals',
        'Business Consultants',
        'Emerging Business Leaders',
        'Institutions',
        'Organisations supporting entrepreneurship',
    ],
};

// ======================================================= why it matters

export const MATTERS_INTRO = {
    heading: 'Why ACTIV Membership Matters',
    subtitle: 'One Membership. Multiple Possibilities.',
};

export interface MattersItem {
    icon: LucideIcon;
    title: string;
    body: string;
}

export const WHY_IT_MATTERS: MattersItem[] = [
    {
        icon: Network,
        title: 'Business Networking',
        body: 'Meet entrepreneurs, professionals, institutions and industry stakeholders.',
    },
    {
        icon: GraduationCap,
        title: 'Knowledge',
        body: 'Learn through seminars, workshops, webinars and expert interactions.',
    },
    {
        icon: Store,
        title: 'Market Access',
        body: 'Explore business connections, exhibitions, buyer–seller interactions and new markets.',
    },
    {
        icon: Landmark,
        title: 'Government Connect',
        body: 'Understand schemes, policies, procurement and entrepreneurship initiatives.',
    },
    {
        icon: TrendingUp,
        title: 'Competitiveness',
        body: 'Improve your knowledge, capabilities, systems and business practices.',
    },
    {
        icon: Eye,
        title: 'Visibility',
        body: 'Showcase your enterprise through ACTIV programmes and platforms.',
    },
    {
        icon: Handshake,
        title: 'Collaboration',
        body: 'Find potential partners, suppliers, customers and service providers.',
    },
    {
        icon: HeartHandshake,
        title: 'Empowerment',
        body: 'Be part of a collective movement for inclusive entrepreneurship and wealth creation.',
    },
];

// ============================================================ the closing

export const CLOSING = {
    heading: 'Be More Than a Business Owner.',
    headingHighlight: 'Be Part of a Business Community.',
    body: [
        'Your business may be small today.',
        'Your ambition doesn’t have to be.',
    ],
    note: 'ACTIV provides the network, knowledge, platforms and connections that can help entrepreneurs take the next step.',
    callHeading: 'Join ACTIV Today',
    callLines: [
        'Connect with Entrepreneurs.',
        'Access Opportunities.',
        'Build Competitiveness.',
        'Expand Your Market.',
        'Create Wealth.',
    ],
    statement: 'ACTIV — Chamber of Commerce for Social Marginals like SC/ST and Women Entrepreneurs in India.',
    invitation: 'Become an ACTIV Member and grow with the network.',
    enquiriesHeading: 'Membership Enquiries',
    website: 'www.activ.org.in',
    email: 'info@activ.org.in',
};
