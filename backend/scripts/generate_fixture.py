"""Generate the synthetic patient fixture (`fixtures/patients.json`).

Every patient is invented: names are drawn from common-name lists, emails use
example.com, and phone numbers use the 555-01xx range reserved for fiction.
The generator is seeded, so running it again reproduces the same file.

Usage (from `backend/`): python -m scripts.generate_fixture
"""

import json
import random
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

PATIENT_COUNT = 200
SEED = 20261113
# "Today" for the fixture: visits and notes are dated relative to this.
REFERENCE_DATE = date(2026, 11, 1)
OUTPUT = Path(__file__).resolve().parent.parent / "fixtures" / "patients.json"

# --- Names -----------------------------------------------------------------
# (weight, female first names, male first names, surnames)
NAME_GROUPS: list[tuple[int, list[str], list[str], list[str]]] = [
    (
        17,  # Anglo-American, born before 1970
        [
            "Margaret",
            "Dorothy",
            "Susan",
            "Karen",
            "Linda",
            "Barbara",
            "Patricia",
            "Ruth",
            "Evelyn",
            "Carol",
            "Nancy",
            "Helen",
        ],
        [
            "James",
            "Robert",
            "Richard",
            "Thomas",
            "Walter",
            "Gerald",
            "Harold",
            "Dennis",
            "Frank",
            "Raymond",
            "Kenneth",
        ],
        [
            "Smith",
            "Johnson",
            "Miller",
            "Anderson",
            "Taylor",
            "Thompson",
            "Clark",
            "Baker",
            "Campbell",
            "Sullivan",
            "Murphy",
            "O'Brien",
            "Peterson",
            "Schneider",
            "Fischer",
            "Larsen",
            "Novak",
            "Rossi",
        ],
    ),
    (
        17,  # Anglo-American, born 1970 or later
        [
            "Emma",
            "Olivia",
            "Charlotte",
            "Abigail",
            "Hannah",
            "Grace",
            "Megan",
            "Ashley",
            "Jennifer",
            "Chloe",
            "Zoe",
            "Madison",
        ],
        [
            "William",
            "Henry",
            "Benjamin",
            "Ethan",
            "Jack",
            "Andrew",
            "Matthew",
            "Christopher",
            "Michael",
            "Noah",
            "Liam",
        ],
        [
            "Smith",
            "Johnson",
            "Miller",
            "Anderson",
            "Taylor",
            "Thompson",
            "Clark",
            "Baker",
            "Campbell",
            "Sullivan",
            "Murphy",
            "O'Brien",
            "Peterson",
            "Schneider",
            "Fischer",
            "Larsen",
            "Novak",
            "Rossi",
        ],
    ),
    (
        18,
        [
            "Sofia",
            "Isabella",
            "Camila",
            "Valentina",
            "Maria",
            "Guadalupe",
            "Lucia",
            "Elena",
            "Carmen",
            "Gabriela",
            "Rosa",
        ],
        [
            "Mateo",
            "Santiago",
            "Diego",
            "Luis",
            "Carlos",
            "Jose",
            "Juan",
            "Miguel",
            "Alejandro",
            "Javier",
            "Rafael",
        ],
        [
            "Garcia",
            "Rodriguez",
            "Martinez",
            "Hernandez",
            "Lopez",
            "Gonzalez",
            "Perez",
            "Sanchez",
            "Ramirez",
            "Torres",
            "Flores",
            "Rivera",
            "Morales",
            "Castillo",
            "Vargas",
        ],
    ),
    (
        12,
        [
            "Aaliyah",
            "Imani",
            "Jasmine",
            "Nia",
            "Ebony",
            "Latoya",
            "Simone",
            "Tiana",
            "Denise",
            "Monique",
        ],
        [
            "Malik",
            "Darnell",
            "Jamal",
            "DeShawn",
            "Marcus",
            "Terrence",
            "Andre",
            "Isaiah",
            "Tyrone",
            "Xavier",
        ],
        [
            "Williams",
            "Jackson",
            "Washington",
            "Jefferson",
            "Robinson",
            "Harris",
            "Brooks",
            "Coleman",
            "Banks",
            "Freeman",
        ],
    ),
    (
        4,
        ["Mei", "Jing", "Xiu", "Lan", "Ying", "Grace"],
        ["Wei", "Jun", "Hao", "Ming", "Jian", "Kevin"],
        ["Wang", "Li", "Zhang", "Chen", "Liu", "Lin", "Huang", "Wu"],
    ),
    (
        2,
        ["Ji-woo", "Seo-yeon", "Min-ji", "Hye-jin"],
        ["Min-jun", "Ji-ho", "Sung-min", "Dong-hyun"],
        ["Kim", "Park", "Lee", "Choi", "Jung", "Kang"],
    ),
    (
        2,
        ["Yuki", "Sakura", "Haruka", "Aiko"],
        ["Hiroshi", "Kenji", "Takumi", "Daichi"],
        ["Tanaka", "Suzuki", "Sato", "Yamamoto", "Nakamura", "Watanabe"],
    ),
    (
        3,
        ["Linh", "Mai", "Thuy", "Lan", "Huong"],
        ["Minh", "Tuan", "Duc", "Hieu", "Quang"],
        ["Nguyen", "Tran", "Le", "Pham", "Vo", "Dang"],
    ),
    (
        8,
        ["Priya", "Ananya", "Divya", "Meera", "Kavita", "Sunita", "Pooja", "Neha"],
        ["Arjun", "Rohan", "Vikram", "Sanjay", "Rahul", "Imran", "Anil", "Deepak"],
        [
            "Patel",
            "Sharma",
            "Singh",
            "Kumar",
            "Gupta",
            "Reddy",
            "Iyer",
            "Khan",
            "Chaudhry",
            "Desai",
        ],
    ),
    (
        5,
        ["Layla", "Fatima", "Noor", "Yasmin", "Zainab", "Mariam"],
        ["Omar", "Ahmed", "Yusuf", "Hassan", "Karim", "Tariq"],
        ["Haddad", "Khalil", "Nasser", "Rahman", "Farouk", "Aziz", "Mansour"],
    ),
    (
        5,
        ["Chioma", "Adaeze", "Amara", "Abena", "Makeda", "Ngozi"],
        ["Chinedu", "Oluwaseun", "Kwame", "Tunde", "Dawit", "Emeka"],
        ["Okafor", "Adeyemi", "Mensah", "Okonkwo", "Bekele", "Diallo", "Nwosu"],
    ),
    (
        4,
        ["Katarzyna", "Anastasia", "Oksana", "Ivana", "Svetlana"],
        ["Dmitri", "Aleksander", "Pavel", "Mikhail", "Tomasz"],
        ["Ivanov", "Petrov", "Kowalczyk", "Popescu", "Horvat", "Kovalenko"],
    ),
    (
        3,
        ["Leilani", "Kaya", "Aiyana", "Malia"],
        ["Kai", "Keanu", "Koa", "Makoa"],
        ["Kealoha", "Begay", "Yazzie", "Kahale", "Tsosie"],
    ),
]
OLDER_ANGLO, YOUNGER_ANGLO = 0, 1

# --- Addresses: one practice, so every patient lives in the same metro area --
# (city, postal code, telephone area code)
PLACES = [
    ("Seattle", "98103", "206"), ("Seattle", "98105", "206"), ("Seattle", "98107", "206"),
    ("Seattle", "98112", "206"), ("Seattle", "98115", "206"), ("Seattle", "98117", "206"),
    ("Seattle", "98118", "206"), ("Seattle", "98122", "206"), ("Seattle", "98125", "206"),
    ("Seattle", "98144", "206"), ("Shoreline", "98133", "206"), ("Burien", "98166", "206"),
    ("Mercer Island", "98040", "206"), ("Bellevue", "98004", "425"), ("Bellevue", "98006", "425"),
    ("Redmond", "98052", "425"), ("Kirkland", "98033", "425"), ("Renton", "98057", "425"),
    ("Bothell", "98011", "425"), ("Issaquah", "98027", "425"), ("Lynnwood", "98036", "425"),
    ("Everett", "98201", "425"), ("Kent", "98032", "253"), ("Federal Way", "98003", "253"),
    ("Tacoma", "98405", "253"),
]  # fmt: skip
STREET_NAMES = [
    "Pine",
    "Maple",
    "Alder",
    "Cedar",
    "Olive",
    "Union",
    "Madison",
    "Jackson",
    "Yesler",
    "Rainier",
    "Aurora",
    "Greenwood",
    "Phinney",
    "Roosevelt",
    "Fremont",
    "Beacon",
    "Holman",
    "Market",
    "Juniper",
    "Larch",
    "15th",
    "23rd",
    "35th",
    "45th",
    "65th",
]
STREET_SUFFIXES = ["St", "Ave", "Way", "Blvd", "Pl", "Dr"]
DIRECTIONS = ["", "", "N ", "NE ", "NW ", "S ", "SW ", "E ", "W "]

BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-", None]
BLOOD_TYPE_WEIGHTS = [35.5, 33.9, 8.1, 3.2, 6.3, 6.0, 1.4, 0.6, 5.0]  # None = not on file

# (allergy, probability)
ALLERGIES = [
    ("Penicillin", 0.08), ("Pollen", 0.07), ("Dust mites", 0.04), ("Sulfa drugs", 0.03),
    ("Cat dander", 0.03), ("Peanuts", 0.025), ("Shellfish", 0.025), ("Amoxicillin", 0.02),
    ("Ibuprofen", 0.02), ("Latex", 0.02), ("Bee stings", 0.02), ("Aspirin", 0.015),
    ("Codeine", 0.015), ("Tree nuts", 0.015), ("Eggs", 0.01), ("Iodinated contrast", 0.01),
]  # fmt: skip

# Age bands: (minimum age, maximum age, share of patients, [(condition, probability)])
AGE_BANDS: list[tuple[int, int, float, list[tuple[str, float]]]] = [
    (0, 12, 0.12, [
        ("Asthma", 0.10), ("Eczema", 0.08), ("Allergic rhinitis", 0.08), ("ADHD", 0.06),
        ("Type 1 diabetes", 0.015),
    ]),
    (13, 19, 0.07, [
        ("Asthma", 0.10), ("Anxiety", 0.10), ("ADHD", 0.09), ("Allergic rhinitis", 0.08),
        ("Migraine", 0.06), ("Depression", 0.06), ("Eczema", 0.04), ("Type 1 diabetes", 0.02),
    ]),
    (20, 44, 0.30, [
        ("Anxiety", 0.14), ("Depression", 0.12), ("Obesity", 0.12), ("Allergic rhinitis", 0.10),
        ("Migraine", 0.09), ("Asthma", 0.08), ("GERD", 0.08), ("Hypertension", 0.08),
        ("Hypothyroidism", 0.04), ("Iron deficiency anemia", 0.04), ("Type 2 diabetes", 0.03),
        ("Sleep apnea", 0.03), ("Type 1 diabetes", 0.01),
    ]),
    (45, 64, 0.28, [
        ("Hypertension", 0.38), ("Hyperlipidemia", 0.32), ("Obesity", 0.18),
        ("Type 2 diabetes", 0.16), ("GERD", 0.16), ("Osteoarthritis", 0.14),
        ("Depression", 0.12), ("Chronic low back pain", 0.12), ("Anxiety", 0.10),
        ("Sleep apnea", 0.10), ("Hypothyroidism", 0.09), ("Asthma", 0.06),
        ("Coronary artery disease", 0.05), ("Migraine", 0.05), ("COPD", 0.04),
        ("Chronic kidney disease", 0.03),
    ]),
    (65, 97, 0.23, [
        ("Hypertension", 0.62), ("Hyperlipidemia", 0.48), ("Osteoarthritis", 0.34),
        ("Type 2 diabetes", 0.26), ("Coronary artery disease", 0.18), ("GERD", 0.18),
        ("Osteoporosis", 0.16), ("Chronic kidney disease", 0.14), ("Hypothyroidism", 0.13),
        ("Atrial fibrillation", 0.12), ("COPD", 0.11), ("Depression", 0.10),
        ("Chronic low back pain", 0.10), ("Heart failure", 0.08), ("Sleep apnea", 0.08),
        ("Dementia", 0.06),
    ]),
]  # fmt: skip
MAX_CONDITIONS = 5
# Conditions that can put a patient in the "critical" status.
SERIOUS_CONDITIONS = {
    "Heart failure", "COPD", "Coronary artery disease", "Chronic kidney disease",
    "Atrial fibrillation", "Type 1 diabetes", "Type 2 diabetes", "Dementia",
}  # fmt: skip

Rng = random.Random
NoteTemplate = Callable[[Rng], str]


def bp(r: Rng, low: int = 112, high: int = 138) -> str:
    return f"{r.randint(low, high)}/{r.randint(68, 88)}"


# --- Clinical note templates -------------------------------------------------
CONDITION_NOTES: dict[str, list[NoteTemplate]] = {
    "Hypertension": [
        lambda r: (
            f"Hypertension follow-up. Home readings averaging {bp(r, 124, 142)}. Tolerating "
            "lisinopril without cough or dizziness. Continue current dose; recheck in 3 months."
        ),
        lambda r: (
            f"Blood pressure elevated today at {bp(r, 148, 166)}. Discussed sodium intake and "
            "medication adherence. Increased amlodipine to 10 mg daily; nurse BP check in 2 weeks."
        ),
    ],
    "Hyperlipidemia": [
        lambda r: (
            f"Lipid panel reviewed: LDL {r.randint(82, 148)} mg/dL. Continue atorvastatin "
            "20 mg nightly. Encouraged regular aerobic exercise and a Mediterranean-style diet."
        ),
    ],
    "Type 2 diabetes": [
        lambda r: (
            f"Diabetes follow-up. A1c {r.uniform(6.4, 8.9):.1f}%. Continue metformin 1000 mg "
            "twice daily. Monofilament foot exam normal; annual eye exam due."
        ),
        lambda r: (
            f"Reviewed glucose log: fasting values {r.randint(105, 130)}-"
            f"{r.randint(140, 185)} mg/dL. Reinforced carbohydrate counting. Referred to diabetes "
            "education."
        ),
    ],
    "Type 1 diabetes": [
        lambda r: (
            f"Type 1 diabetes review. Continuous glucose monitor shows {r.randint(58, 81)}% "
            "time in range. Adjusted overnight basal rate. No severe hypoglycemia reported."
        ),
    ],
    "Asthma": [
        lambda r: (
            f"Asthma follow-up. Using rescue inhaler about {r.randint(1, 4)} times per week. "
            "Inhaler technique reviewed. Continue daily controller inhaler."
        ),
        lambda r: (
            f"Presented with wheezing after a cold. Peak flow at {r.randint(62, 78)}% of "
            "personal best. Nebulizer treatment given in clinic with good response."
        ),
    ],
    "COPD": [
        lambda r: (
            "COPD follow-up. Reports more shortness of breath on stairs. SpO2 "
            f"{r.randint(90, 95)}% on room air. Continued tiotropium; pulmonary rehab "
            "referral placed."
        ),
    ],
    "Coronary artery disease": [
        lambda r: (
            "Coronary artery disease follow-up. No chest pain or exertional symptoms. "
            f"BP {bp(r)}. Continues antiplatelet and statin therapy; walking 30 minutes most days."
        ),
    ],
    "Atrial fibrillation": [
        lambda r: (
            f"Atrial fibrillation follow-up. Rate controlled at {r.randint(64, 88)} bpm. "
            "Anticoagulation continued; no bleeding events or palpitations reported."
        ),
    ],
    "Heart failure": [
        lambda r: (
            "Heart failure follow-up. Weight stable, sleeping on "
            f"{r.randint(1, 2)} pillow(s), trace ankle edema. Continue diuretic; daily weights "
            "reinforced."
        ),
    ],
    "Chronic kidney disease": [
        lambda r: (
            f"Chronic kidney disease monitoring. eGFR {r.randint(38, 58)} mL/min, stable. "
            "Advised to avoid NSAIDs. Repeat labs in 3 months."
        ),
    ],
    "Osteoarthritis": [
        lambda r: (
            f"Knee osteoarthritis follow-up. Pain {r.randint(3, 7)}/10 on stairs. Discussed "
            "weight management and physical therapy. Topical therapy continued."
        ),
    ],
    "Osteoporosis": [
        lambda r: (
            f"Bone density results reviewed: T-score -{r.uniform(2.5, 3.2):.1f}. Continue "
            "weekly alendronate with calcium and vitamin D. Fall-prevention counseling provided."
        ),
    ],
    "Hypothyroidism": [
        lambda r: (
            f"Hypothyroidism follow-up. TSH {r.uniform(0.9, 3.8):.1f} mIU/L, within range. "
            "Continue levothyroxine at current dose."
        ),
    ],
    "GERD": [
        lambda r: (
            f"Reports heartburn {r.randint(2, 5)} nights per week. Advised smaller evening "
            "meals and raising the head of the bed. Started omeprazole 20 mg daily for 8 weeks."
        ),
    ],
    "Depression": [
        lambda r: (
            f"Depression follow-up. PHQ-9 score {r.randint(4, 12)}, improved from prior "
            "visit. Tolerating sertraline. Continues counseling every two weeks."
        ),
    ],
    "Anxiety": [
        lambda r: (
            f"Anxiety follow-up. GAD-7 score {r.randint(5, 13)}. Sleep improving. Continue "
            "current treatment plan; reviewed breathing techniques."
        ),
    ],
    "Migraine": [
        lambda r: (
            f"Migraine follow-up. {r.randint(2, 7)} headache days in the past month. "
            "Sumatriptan effective when taken early. Headache diary reviewed."
        ),
    ],
    "Sleep apnea": [
        lambda r: (
            f"Sleep apnea follow-up. Using CPAP {r.uniform(4.5, 7.5):.1f} hours nightly; "
            "daytime sleepiness improved. Mask fit checked."
        ),
    ],
    "Chronic low back pain": [
        lambda r: (
            f"Chronic low back pain follow-up. Pain {r.randint(3, 6)}/10, no leg weakness or "
            "numbness. Continuing home exercise program from physical therapy."
        ),
    ],
    "ADHD": [
        lambda r: (
            "ADHD medication check. Reports improved focus and task completion. Appetite "
            f"and sleep acceptable. BP {bp(r, 100, 122)}. Continue current dose."
        ),
    ],
    "Eczema": [
        lambda r: (
            "Eczema flare on both forearms. Prescribed a topical steroid for 2 weeks and "
            "reviewed the daily moisturizing routine."
        ),
    ],
    "Allergic rhinitis": [
        lambda r: (
            "Seasonal allergy symptoms: sneezing and itchy eyes. Started a daily "
            "antihistamine and nasal steroid spray."
        ),
    ],
    "Dementia": [
        lambda r: (
            f"Memory follow-up with family present. MoCA score {r.randint(14, 22)}/30. "
            "Discussed home safety and caregiver support resources."
        ),
    ],
    "Obesity": [
        lambda r: (
            f"Weight management visit. Weight down {r.randint(2, 9)} lb since last visit. "
            "Reviewed food diary and activity goals."
        ),
    ],
    "Iron deficiency anemia": [
        lambda r: (
            f"Iron deficiency anemia follow-up. Hemoglobin {r.uniform(10.4, 12.2):.1f} g/dL, "
            "improving on oral iron. Recheck in 8 weeks."
        ),
    ],
}
ADULT_NOTES: list[NoteTemplate] = [
    lambda r: (
        f"Annual physical exam. Reports feeling well overall. BP {bp(r)}, HR "
        f"{r.randint(58, 84)}, BMI {r.uniform(20.5, 31.5):.1f}. Routine labs ordered. "
        "Discussed diet, "
        "exercise and sleep."
    ),
    lambda r: (
        f"Seen for cough and congestion for {r.randint(3, 7)} days, no fever. Lungs clear "
        "on exam. Likely viral; advised rest and fluids, return if symptoms worsen."
    ),
    lambda r: "Influenza vaccine administered, left deltoid. No immediate adverse reaction.",
    lambda r: (
        "Telehealth visit. Medication list reviewed and reconciled. No new concerns reported."
    ),
    lambda r: (
        "Strained lower back while lifting. No red-flag symptoms. Recommended stretching, "
        "heat and acetaminophen as needed; physical therapy referral offered."
    ),
]
CHILD_NOTES: list[NoteTemplate] = [
    lambda r: (
        f"Well-child visit. Growth tracking along the {r.choice([25, 40, 50, 60, 75])}th "
        "percentile for height and weight. Development appropriate for age. "
        "Immunizations up to date."
    ),
    lambda r: (
        f"Seen with parent for ear pain and fever of {r.uniform(100.4, 102.6):.1f} F. "
        "Right eardrum red and bulging. Treated for acute otitis media after reviewing "
        "allergy history."
    ),
    lambda r: "Sports physical completed. Cleared for participation without restrictions.",
    lambda r: (
        f"Sore throat for {r.randint(2, 4)} days. Rapid strep test negative. Supportive "
        "care advised; parent to call if fever persists."
    ),
]
URGENT_NOTES: dict[str, str] = {
    "Heart failure": "Urgent visit: worsening shortness of breath and 6 lb weight gain over one "
    "week. Diuretic dose increased; follow-up in 48 hours.",
    "COPD": "Urgent visit: COPD exacerbation with increased sputum and wheeze. Started "
    "prednisone and antibiotics; follow-up in 48 hours.",
    "Coronary artery disease": "Urgent visit: new exertional chest tightness over the past week. "
    "ECG unchanged from baseline. Same-week cardiology appointment arranged.",
    "Chronic kidney disease": "Urgent visit: labs show a sharp drop in kidney function. "
    "Medications adjusted; nephrology contacted for expedited review.",
    "Atrial fibrillation": "Urgent visit: palpitations with heart rate 130-140 bpm. Rate-control "
    "medication increased; follow-up in 48 hours.",
    "Type 1 diabetes": "Urgent visit: repeated blood glucose readings above 350 mg/dL with "
    "ketones. Insulin plan adjusted; daily phone check-ins arranged.",
    "Type 2 diabetes": "Urgent visit: blood glucose readings above 400 mg/dL for three days. "
    "Started basal insulin; follow-up in 48 hours.",
    "Dementia": "Urgent visit: family reports sudden increase in confusion. Urine and blood "
    "tests ordered to look for infection; follow-up in 48 hours.",
}
DEFAULT_URGENT_NOTE = (
    "Urgent visit after recent hospital discharge. Medications reconciled and warning signs "
    "reviewed; follow-up in 48 hours."
)


def weighted_choice[T](r: Rng, options: list[T], weights: list[float]) -> T:
    return r.choices(options, weights=weights, k=1)[0]


def pick_date_of_birth(r: Rng, index: int) -> tuple[date, list[tuple[str, float]]]:
    """Choose a birth date and return it with the condition odds for that age."""
    # Pin the extremes so the fixture always covers them.
    pinned_ages = {0: 0, 1: 97, 2: 18, 3: 65}
    if index in pinned_ages:
        age = pinned_ages[index]
        band = next(b for b in AGE_BANDS if b[0] <= age <= b[1])
    else:
        band = weighted_choice(r, AGE_BANDS, [b[2] for b in AGE_BANDS])
        age = r.randint(band[0], band[1])
    days_since_birthday = r.randint(20, 364) if age == 0 else r.randint(0, 364)
    born = REFERENCE_DATE.replace(year=REFERENCE_DATE.year - age) - timedelta(
        days=days_since_birthday
    )
    return born, band[3]


def pick_name(r: Rng, born: date, used: set[tuple[str, str]]) -> tuple[str, str]:
    while True:
        index = weighted_choice(
            r, list(range(len(NAME_GROUPS))), [group[0] for group in NAME_GROUPS]
        )
        if index == OLDER_ANGLO and born.year >= 1970:
            index = YOUNGER_ANGLO
        elif index == YOUNGER_ANGLO and born.year < 1970:
            index = OLDER_ANGLO
        _, female, male, surnames = NAME_GROUPS[index]
        first = r.choice(female if r.random() < 0.51 else male)
        # Now and then, a surname from another group (marriage, adoption).
        if r.random() < 0.08:
            surnames = r.choice(NAME_GROUPS)[3]
        name = (first, r.choice(surnames))
        if name not in used:
            used.add(name)
            return name


def pick_status(r: Rng, conditions: list[str]) -> str:
    serious = sum(1 for condition in conditions if condition in SERIOUS_CONDITIONS)
    if r.random() < 0.02 + 0.22 * serious:
        return "critical"
    return "inactive" if r.random() < 0.22 else "active"


def pick_last_visit(r: Rng, status: str, born: date) -> date | None:
    if status == "critical":
        days_ago = r.randint(0, 21)
    elif status == "inactive":
        days_ago = r.randint(420, 1900)
    elif r.random() < 0.04:
        return None  # registered, not yet seen
    else:
        days_ago = int(r.triangular(1, 330, 30))
    return max(REFERENCE_DATE - timedelta(days=days_ago), born + timedelta(days=3))


def clinic_time(r: Rng, day: date) -> str:
    """A timestamp during clinic hours (08:00-16:45 Pacific, written in UTC)."""
    moment = datetime.combine(day, time(16, 0), tzinfo=UTC) + timedelta(
        minutes=15 * r.randint(0, 35)
    )
    return moment.isoformat().replace("+00:00", "Z")


def make_notes(
    r: Rng, born: date, last_visit: date | None, status: str, conditions: list[str]
) -> list[dict[str, str]]:
    if last_visit is None:
        return []
    count = weighted_choice(r, [0, 1, 2, 3, 4, 5], [8, 24, 30, 20, 12, 6])
    if status == "critical":
        count = max(count, 2)

    age_at_visit = (last_visit - born).days // 365
    general = CHILD_NOTES if age_at_visit < 18 else ADULT_NOTES
    specific = [template for c in conditions for template in CONDITION_NOTES[c]]
    r.shuffle(specific)
    pool = specific[:3] + r.sample(general, k=len(general))

    notes: list[dict[str, str]] = []
    day = last_visit
    for position in range(count):
        if day < born + timedelta(days=3) or position >= len(pool):
            break
        if position == 0 and status == "critical":
            urgent = next((URGENT_NOTES[c] for c in conditions if c in URGENT_NOTES), None)
            content = urgent or DEFAULT_URGENT_NOTE
        else:
            content = pool[position](r)
        notes.append(
            {
                "id": str(uuid.UUID(int=r.getrandbits(128), version=4)),
                "timestamp": clinic_time(r, day),
                "content": content,
            }
        )
        day -= timedelta(days=r.randint(30, 240))
    return notes


def email_for(first: str, last: str, used: set[str]) -> str:
    def slug(value: str) -> str:
        return "".join(ch for ch in value.lower() if ch.isalpha())

    base = f"{slug(first)}.{slug(last)}"
    candidate, suffix = base, 1
    while candidate in used:
        suffix += 1
        candidate = f"{base}{suffix}"
    used.add(candidate)
    return f"{candidate}@example.com"


def make_patient(r: Rng, index: int, names: set[tuple[str, str]], emails: set[str]) -> dict:
    born, condition_odds = pick_date_of_birth(r, index)
    age = (REFERENCE_DATE - born).days // 365
    first, last = pick_name(r, born, names)

    conditions = [
        name
        for name, odds in condition_odds
        if r.random() < odds and not (name == "ADHD" and age < 6)
    ]
    conditions = [c for c in conditions if not (c == "Dementia" and age < 72)][:MAX_CONDITIONS]
    allergies = [name for name, odds in ALLERGIES if r.random() < odds]
    status = pick_status(r, conditions)
    last_visit = pick_last_visit(r, status, born)

    city, postal_code, area_code = r.choice(PLACES)
    street = (
        f"{r.randint(100, 19999)} {r.choice(DIRECTIONS)}{r.choice(STREET_NAMES)} "
        f"{r.choice(STREET_SUFFIXES)}"
    )
    unit = r.choice([f"Apt {r.randint(1, 40)}{r.choice('ABCD')}", f"Unit {r.randint(100, 950)}"])
    # Young children have no email of their own; some older patients never gave one.
    has_email = age >= 16 and not (age >= 75 and r.random() < 0.35)

    return {
        "id": str(uuid.UUID(int=r.getrandbits(128), version=4)),
        "first_name": first,
        "last_name": last,
        "date_of_birth": born.isoformat(),
        "email": email_for(first, last, emails) if has_email else None,
        "phone": f"({area_code}) 555-01{r.randint(0, 99):02d}",
        "address_line1": street,
        "address_line2": unit if r.random() < 0.28 else None,
        "city": city,
        "state": "WA",
        "postal_code": postal_code,
        "blood_type": weighted_choice(r, BLOOD_TYPES, BLOOD_TYPE_WEIGHTS),
        "allergies": allergies,
        "conditions": conditions,
        "status": status,
        "last_visit": last_visit.isoformat() if last_visit else None,
        "notes": make_notes(r, born, last_visit, status, conditions),
    }


def generate() -> dict:
    r = random.Random(SEED)
    names: set[tuple[str, str]] = set()
    emails: set[str] = set()
    patients = [make_patient(r, index, names, emails) for index in range(PATIENT_COUNT)]
    r.shuffle(patients)
    return {"patients": patients}


if __name__ == "__main__":
    data = generate()
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    notes = sum(len(patient["notes"]) for patient in data["patients"])
    print(f"Wrote {len(data['patients'])} patients and {notes} notes to {OUTPUT}")
