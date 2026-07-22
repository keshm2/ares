# Research — AI job-application competitors: job sourcing and ATS/careers-system support

## Summary
The strongest direct-ATS competitors are Tsenta, Aplyr, ApplyCove, LoopCV, Simplify, and Jobright: they claim either direct ATS/career-page ingestion for job sourcing or broad ATS autofill/application support — https://tsenta.com/ai-disclosure, https://aplyr.ai/l/top-software-engineering-jobs, https://applycove.com/job-matches/, https://www.loopcv.pro/job-board-api/, https://simplify.jobs/copilot, https://jobright.ai/blog/supercharge-your-job-search-with-jobright-autofill/. The market splits into two product motions: (1) job-source aggregators/agents that monitor company ATS/career pages and submit applications, and (2) browser autofill tools that rely on the user to bring the job page — https://jobcopilot.com/, https://openapplier.com/for, https://jobwizard.ai/features/smart-autofill, https://getlentra.com/. Build toward source freshness plus reliable ATS coverage first; the clearest visible differentiator is explicit support for high-friction ATSs rather than vague “works everywhere” claims — https://tsenta.com/llms-full.txt, https://openapplier.com/for.

## Approaches / Subtopics
### aplyr.ai
- Job sourcing: Aplyr claims “1,000,000+ jobs” and “5,000+ companies” on the homepage, and describes search as “1M+ jobs from every major ATS” — https://aplyr.ai/.
- Freshness/source mechanism: a software-engineering jobs page says jobs are “verified live within the last 24 hours via direct ATS ingestion” and that new jobs are picked up from “the source” usually within an hour of posting — https://aplyr.ai/l/top-software-engineering-jobs.
- ATS/careers support: Aplyr says “one-click applications across all major ATSs,” but I did not find a public first-party list of named ATSs in the fetched pages — https://aplyr.ai/.
- Confidence: High that Aplyr positions around direct ATS ingestion and broad ATS application support; medium-low on exact ATS coverage because the public pages use “every/all major ATS” rather than listing systems — https://aplyr.ai/, https://aplyr.ai/l/top-software-engineering-jobs.

### Tsenta
- Job sourcing: Tsenta says it watches “50,000+ career pages” and submits a tailored résumé when a fitting role appears — https://tsenta.com/.
- Job sourcing detail: its AI disclosure says the product monitors “50,000+ company career pages” 24/7 and uses résumé-aware matching rather than keyword-only search — https://tsenta.com/ai-disclosure.
- ATS/careers support: Tsenta publishes a first-party list of 19 supported systems: Workday, Greenhouse, Lever, Ashby, Rippling, iCIMS, BambooHR, Workable, JazzHR, Jobvite, BreezyHR, Oracle Cloud, SmartRecruiters, Paylocity, UltiPro, ADP, Dover, Gem, and Zoho Recruit — https://tsenta.com/ai-disclosure.
- Application automation: Tsenta says it handles login, every field, open-ended answers, and uploads across those 19 ATSes — https://tsenta.com/llms-full.txt.
- Confidence: High; support list and sourcing mechanism are first-party and explicit — https://tsenta.com/ai-disclosure, https://tsenta.com/llms-full.txt.

### JobCopilot
- Job sourcing: JobCopilot says it automatically applies to jobs from “500,000+ companies worldwide” and that its copilot looks for new jobs daily on “over 500,000 company career pages” — https://jobcopilot.com/.
- Source quality claim: JobCopilot says it “exclusively applies to verified jobs on official company career pages” — https://jobcopilot.com/.
- ATS/careers support: the Chrome extension page says it works on company pages, job boards, and ATS forms, including forms not scanned by the main copilot, but the fetched official extension page does not name a complete ATS list — https://jobcopilot.com/chrome-extension/.
- ATS/careers support detail: the tutorial says the extension works on application forms rather than job-description pages and warns that “some systems (e.g., Workday) may require additional manual input” — https://jobcopilot.com/chrome-extension-tutorial/.
- Confidence: High on company-career-page sourcing; medium-low on named ATS coverage because official pages are broad and only explicitly mention Workday in the fetched tutorial — https://jobcopilot.com/, https://jobcopilot.com/chrome-extension-tutorial/.

### Simplify / Simplify Copilot
- Job sourcing: Simplify’s AI job-search page says its AI matches a profile against “thousands of opportunities in real time” and can tailor, network, and apply automatically — https://simplify.jobs/ai-job-search.
- Job sourcing/product surface: Simplify’s setup doc references applying from “Job Matches or the job board inside Simplify,” implying an internal job-discovery feed in addition to extension autofill — https://help.simplify.jobs/articles/1749022-installing-and-setting-up-copilot.
- ATS/careers support: Simplify’s Copilot FAQ says autofill works on “over 100 job boards and application portals” including Workday, Greenhouse, iCIMS, Taleo, Avature, Lever, and SmartRecruiters — https://simplify.jobs/copilot.
- ATS/careers support detail: Simplify’s help doc says Copilot works across common applicant tracking systems and career sites including Workday, Lever, Greenhouse, Ashby, iCIMS, and Taleo — https://help.simplify.jobs/articles/1749022-installing-and-setting-up-copilot.
- Unsupported pages: Simplify says unsupported application pages can still use the Copilot profile tab for manual copy/paste, so direct autofill coverage is not universal — https://help.simplify.jobs/articles/2415391-using-copilot-to-autofill-applications.
- Confidence: High on the named ATS list and >100 portals claim; medium on sourcing specifics because the public pages describe matching/jobs but not exact upstream job-feed providers — https://simplify.jobs/copilot, https://simplify.jobs/ai-job-search.

### Jobright
- Job sourcing: Jobright’s homepage claims an “8,000,000+” total job hub and “400,000+” new jobs today, with personalized AI job matches and “no fake listings and early alerts” — https://jobright.ai/.
- ATS/careers support: Jobright’s autofill blog says it supports “90% of major ATSs,” naming Workday, Greenhouse, Lever, iCIMS, Ashby, and Workable — https://jobright.ai/blog/supercharge-your-job-search-with-jobright-autofill/.
- ATS/careers support detail: Jobright’s homepage separately says users can apply across “all major ATS platforms,” but it does not name the platforms there — https://jobright.ai/.
- Confidence: High for the six named ATSs because they are first-party; medium for “all major”/“90%” breadth and job-source provenance because the pages do not publish an upstream source list — https://jobright.ai/blog/supercharge-your-job-search-with-jobright-autofill/, https://jobright.ai/.

### Open Applier
- Job sourcing: Open Applier is primarily a Chrome extension/web app for repeat applications, not a public job-source aggregator in the fetched pages — https://openapplier.com/.
- ATS/careers support: Open Applier explicitly says it is live for Workday, Greenhouse, Lever, and Ashby — https://openapplier.com/.
- ATS/careers support detail: its supported-platforms page says it lists only the ATS platforms it fills reliably, naming Workday, Greenhouse, Lever, and Ashby — https://openapplier.com/for.
- Confidence: High for the four named ATSs; high that sourcing is user-provided/job-page-driven based on the fetched pages’ focus on extension filling rather than job aggregation — https://openapplier.com/, https://openapplier.com/for.

### ApplyCove
- Job sourcing: ApplyCove says Job Matches scans “7+ company ATS platforms every day,” ranks roles to the user profile, and applies on the employer’s site through a browser extension — https://applycove.com/job-matches/.
- ATS/careers support: ApplyCove names Greenhouse, Lever, Workday, iCIMS, Ashby, and Rippling, followed by “and more” — https://applycove.com/job-matches/.
- Product split: ApplyCove says its Job Matches engine runs locally in the browser and is separate from its cloud sessions for large job boards; this makes the ATS feature a company-career-system workflow rather than only a job-board bot — https://applycove.com/job-matches/.
- Confidence: High for the six named systems and daily ATS scanning; medium for the “7+” unnamed remainder — https://applycove.com/job-matches/.

### JobWizard
- Job sourcing: JobWizard’s smart-autofill page is an extension/autofill workflow; it tells users to open an application form and then click Autofill — https://jobwizard.ai/features/smart-autofill.
- ATS/careers support: JobWizard says it supports 20+ ATS platforms and names Workday, Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters, and Oracle Taleo, plus thousands of company career sites — https://jobwizard.ai/features/smart-autofill.
- Submission model: JobWizard says users review every field and that it never auto-submits an application — https://jobwizard.ai/features/smart-autofill.
- Confidence: High for the named ATSs and user-driven sourcing model; medium for “20+” total because only a subset is named publicly — https://jobwizard.ai/features/smart-autofill.

### Lentra
- Job sourcing: Lentra’s public page describes an extension-style workflow where the user installs Lentra, uploads a resume, picks a job, and clicks Fill — https://getlentra.com/.
- ATS/careers support: Lentra names Greenhouse, iCIMS, Lever, Workable, Ashby, Workday, SmartRecruiters, and Jobvite as systems it works with — https://getlentra.com/.
- Confidence: High for named autofill targets; low for job sourcing beyond user-selected application pages because no aggregator/source-feed claim appeared on the fetched page — https://getlentra.com/.

### LoopCV
- Job sourcing: LoopCV claims “1.5M+ jobs collected daily” from “30+ ATS and job board sources” through a unified job-board API — https://www.loopcv.pro/job-board-api/.
- ATS/careers support: LoopCV’s API page names Greenhouse, Lever, Ashby, Workday, and “every other job board or ATS” as examples of sources it aggregates — https://www.loopcv.pro/job-board-api/.
- Job-seeker flow: LoopCV says it scans sources daily/every few hours, queues matching openings, fills ATS forms, sends recruiter outreach emails, and applies through its workflow — https://www.loopcv.pro/jobseekers/, https://www.loopcv.pro/auto-apply-for-jobs/.
- Confidence: High that LoopCV is a job-source aggregator; medium on exact ATS coverage because the public page names only a few ATSs and relies on “30+”/“and more” language — https://www.loopcv.pro/job-board-api/, https://www.loopcv.pro/jobseekers/.

### Careerflow
- Job sourcing: Careerflow’s autofill page describes a user-browse workflow where the user searches normally, opens an application form, and the extension fills it — https://www.careerflow.ai/autofill.
- ATS/careers support: Careerflow says its Chrome extension fills applications across Workday, Greenhouse, Lever, and more, and separately says autofill supports major hiring platforms including Greenhouse, Workday, and Lever — https://www.careerflow.ai/autofill.
- Confidence: High for Greenhouse/Workday/Lever autofill; low for any job-sourcing capability because the fetched page is not an auto-apply/job-feed page — https://www.careerflow.ai/autofill.

### Other close ATS-autofill entrants
- TryApplyNow: the extension says it fills Greenhouse, Lever, Workday, and Ashby pages and runs only on those job-site pages plus its own account domain; confidence high for those four systems — https://www.tryapplynow.com/extension.
- ApplyAI: the public GitHub repository describes a free open-source Chrome extension for Greenhouse, Lever, Ashby, Workday, and SmartRecruiters; confidence high for the stated extension scope, but low for commercial traction because the fetched repository metadata showed a newly created repo with no stars/forks — https://github.com/muhammad-saadd/applyai.
- Jobaholic: its public page says it auto-fills Workday, Greenhouse, Lever, Ashby, ADP MyJobs, iCIMS, JazzHR, Jobvite, Phenom, SmartRecruiters, Pinpoint, and more; confidence high for named ATSs — https://www.jobaholic.app/.
- FastApply: its public page says it auto-applies on Workday, Greenhouse, Lever and other platforms, but its headline set also includes large job boards; confidence medium for exact ATS depth because only a short ATS list is public — https://fastapply.co/ai-apply-for-jobs.
- Jobless: its auto-apply page names Greenhouse, Lever, Ashby, and Workday plus “10 more,” with review-before-send; confidence high for the four named systems and medium for unnamed systems — https://www.jobless.dev/auto-apply.

## Conflicts
- No hard contradiction surfaced among first-party sources; the main inconsistency is specificity: Tsenta and Open Applier publish explicit ATS lists, while Aplyr and JobCopilot use broad claims like “all major ATSs” or “ATS” without a public named list in the fetched pages — https://tsenta.com/ai-disclosure, https://openapplier.com/for, https://aplyr.ai/, https://jobcopilot.com/chrome-extension/. Resolution: treat explicit first-party lists as higher-confidence coverage and broad claims as directional until verified with live applications.
- Simplify’s public Copilot page says “over 100 job boards and application portals” and lists Workday, Greenhouse, iCIMS, Taleo, Avature, Lever, and SmartRecruiters, while its setup help article lists common ATSs/career sites including Workday, Lever, Greenhouse, Ashby, iCIMS, and Taleo — https://simplify.jobs/copilot, https://help.simplify.jobs/articles/1749022-installing-and-setting-up-copilot. Resolution: no conflict; combine them as an explicitly named set of Workday, Greenhouse, Lever, Ashby, iCIMS, Taleo, Avature, and SmartRecruiters.
- Jobright’s homepage says “all major ATS platforms,” while its autofill blog says “90% of major ATSs” and names six systems — https://jobright.ai/, https://jobright.ai/blog/supercharge-your-job-search-with-jobright-autofill/. Resolution: use the six named systems as confirmed public coverage and treat broader coverage as unverified.

## Gaps
- Aplyr exact ATS list — no reliable public list found in the fetched first-party pages; the pages claim “every major ATS” and “direct ATS ingestion,” but do not enumerate systems — https://aplyr.ai/, https://aplyr.ai/l/top-software-engineering-jobs. To answer this, look for extension manifests, network-observed apply targets, hidden docs, or live job-detail outbound URLs.
- JobCopilot exact ATS list — no complete first-party public list found; the pages claim official company career-page sourcing and broad ATS support, with Workday explicitly called out as sometimes requiring manual input — https://jobcopilot.com/, https://jobcopilot.com/chrome-extension/, https://jobcopilot.com/chrome-extension-tutorial/. To answer this, look for help-center pages behind login, extension store metadata, or tested application runs on common ATSs.
- Job source provenance for Simplify and Jobright — public pages describe job matching, job hubs, and large opportunity counts, but do not publish a named upstream source list comparable to LoopCV’s “30+ sources” or Tsenta’s “50,000+ career pages” framing — https://simplify.jobs/ai-job-search, https://jobright.ai/, https://www.loopcv.pro/job-board-api/, https://tsenta.com/ai-disclosure. To answer this, look for API responses, sitemap/job URLs, robots-accessible job feeds, or public partnerships.
- Coverage depth versus “form opens” — many extension products list ATS names but do not specify whether they handle account creation, multi-page flows, document upload, knockout questions, EEO fields, or final submit — https://jobwizard.ai/features/smart-autofill, https://getlentra.com/, https://www.careerflow.ai/autofill. To answer this, run a matrix test across representative Workday, Greenhouse, Lever, Ashby, iCIMS, Taleo, SmartRecruiters, and Oracle postings.

## Recommendation
Prioritize a two-layer competitive response: first, build/verify a direct-source job index from employer ATS/career systems, because Aplyr, Tsenta, ApplyCove, and LoopCV all make freshness/source claims central to their positioning; second, publish a precise ATS support matrix rather than saying “all major ATSs,” because Tsenta and Open Applier are more credible where they name systems and JobCopilot/Aplyr are weaker where they do not. The initial target matrix should be Workday, Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters, Taleo/Oracle, Workable, Jobvite, BambooHR, and Rippling because those recur across Tsenta, Simplify, Jobright, ApplyCove, JobWizard, Lentra, LoopCV, and Jobaholic. Treat browser autofill competitors as table stakes, but differentiate on monitored employer-career-page sourcing, source freshness, and transparent “review before submit / auto-submit eligibility” per ATS.

Weakest assumption: public marketing/support pages accurately reflect real production coverage; if live tests show that “supported” often means partial autofill only, then the recommended target matrix should be narrowed to the systems that can be completed reliably end-to-end.

## Sources
1. https://aplyr.ai/ — Aplyr homepage with 1M+ jobs, 5K+ companies, and broad ATS claims.
2. https://aplyr.ai/l/top-software-engineering-jobs — Aplyr role-list page with direct ATS ingestion and freshness claims.
3. https://tsenta.com/ — Tsenta homepage with 50,000+ career-page monitoring and major ATS framing.
4. https://tsenta.com/ai-disclosure — Tsenta disclosure page with 19-system ATS/platform list and feature details.
5. https://tsenta.com/llms-full.txt — Tsenta machine-readable content with exact 19 ATS list and workflow details.
6. https://jobcopilot.com/ — JobCopilot homepage with 500,000+ company-career-page sourcing and official-page verification claims.
7. https://jobcopilot.com/chrome-extension/ — JobCopilot extension page describing company page, job board, and ATS form autofill.
8. https://jobcopilot.com/chrome-extension-tutorial/ — JobCopilot extension tutorial with Workday caveat and usage model.
9. https://simplify.jobs/copilot — Simplify Copilot page with >100 boards/portals and named ATS list.
10. https://help.simplify.jobs/articles/1749022-installing-and-setting-up-copilot — Simplify setup doc naming common ATS/career-site support.
11. https://help.simplify.jobs/articles/2415391-using-copilot-to-autofill-applications — Simplify autofill doc explaining supported and unsupported application pages.
12. https://simplify.jobs/ai-job-search — Simplify AI job-search page describing matching and automated pipeline.
13. https://jobright.ai/ — Jobright homepage with job-hub scale and all-major-ATS claim.
14. https://jobright.ai/blog/supercharge-your-job-search-with-jobright-autofill/ — Jobright blog naming Workday, Greenhouse, Lever, iCIMS, Ashby, and Workable.
15. https://openapplier.com/ — Open Applier homepage naming Workday, Greenhouse, Lever, and Ashby.
16. https://openapplier.com/for — Open Applier supported-ATS page with reliability framing.
17. https://applycove.com/job-matches/ — ApplyCove Job Matches page with daily ATS scanning and named systems.
18. https://jobwizard.ai/features/smart-autofill — JobWizard smart-autofill page with 20+ ATS claim and named systems.
19. https://getlentra.com/ — Lentra homepage with named recruiting systems.
20. https://www.loopcv.pro/job-board-api/ — LoopCV job-board API page with 1.5M daily jobs and 30+ source claim.
21. https://www.loopcv.pro/jobseekers/ — LoopCV job-seeker page describing daily scans and ATS form filling.
22. https://www.loopcv.pro/auto-apply-for-jobs/ — LoopCV auto-apply page describing scanning and submission flow.
23. https://www.careerflow.ai/autofill — Careerflow autofill page naming Workday, Greenhouse, and Lever.
24. https://www.tryapplynow.com/extension — TryApplyNow extension page naming Greenhouse, Lever, Workday, and Ashby.
25. https://github.com/muhammad-saadd/applyai — ApplyAI open-source repository with supported ATS list.
26. https://www.jobaholic.app/ — Jobaholic page with broad ATS autofill list.
27. https://fastapply.co/ai-apply-for-jobs — FastApply page with platform claims including Workday, Greenhouse, and Lever.
28. https://www.jobless.dev/auto-apply — Jobless auto-apply page naming Greenhouse, Lever, Ashby, and Workday.
