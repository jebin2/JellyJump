/* ============================================
   Embeddable analytics — drop into any project
   Usage:
     <script src="https://jebin2.github.io/js/analytics-embed.js"
             data-project="JellyJump"></script>

   Add data-skip-referrer to skip tracking when referred from a specific
   page (prevents double-counting on internal navigation):
     <script src="..." data-project="JellyJump" data-skip-referrer="/JellyJump"></script>
   Fires only if document.referrer does NOT contain the given string.
   ============================================ */
(function () {
    const script = document.currentScript;
    const project = script && script.dataset.project;
    if (!project) return;

    // Skip if referred from a specific page (e.g. the landing page)
    const skipReferrer = script.dataset.skipReferrer;
    if (skipReferrer && document.referrer.includes(skipReferrer)) return;

    fetch('https://bfqcfhvpauvvakgmeuhr.supabase.co/rest/v1/events', {
        method: 'POST',
        headers: {
            'apikey':        'sb_publishable_yH1CSzF3YQ8FpU-hF-QEtg_ZWaKDLsR',
            'Authorization': 'Bearer sb_publishable_yH1CSzF3YQ8FpU-hF-QEtg_ZWaKDLsR',
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal'
        },
        body: JSON.stringify({ event_type: 'project_click', label: project })
    }).catch(function () {});
})();
