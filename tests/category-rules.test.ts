/**
 * კატეგორიის დაზუსტების წესები: ზოგად კატეგორიაში მოსული პროდუქტი სახელით ქვეკატეგორიაში ჯდება.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { refineCategory } from "../src/lib/category-rules";

const leaf = (r: string[] | null) => r?.at(-1) ?? null;
const ST = ["მონაცემთა შენახვა"];
const UPS = ["ენერგო უზრუნველყოფა", "უწყვეტი კვების წყაროები UPS"];
const LANSW = ["LAN & WAN", "სვიჩები (LAN)"];
const RACK = ["LAN & WAN", "საკომუნიკაციო კარადები"];
const VIDEO = ["უსაფრთხოების სისტემები", "ვიდეო-მეთვალყურეობა"];

test("მონაცემთა შენახვა: SSD, HDD, NAS, სერვერი, კომპონენტი", () => {
  assert.equal(leaf(refineCategory({ name: "Kingston 480G DC600M (Mixed-Use) 2.5” Enterprise SATA SSD", brand: "Kingston" }, ST)), "SSD დისკები");
  assert.equal(leaf(refineCategory({ name: "Dell 1.2TB 10K RPM SAS 12Gbps 2.5in Hot-plug Hard Drive", brand: "DELL" }, ST)), "მყარი დისკები (შენახვა)");
  // სერვერს სახელში „SSD“ უწერია — სერვერია და არა დისკი
  assert.equal(leaf(refineCategory({ name: "Dell PE R660xs/ 8x2.5/ 1x4514Y/ 2x32GB/1x960GB SSD/ H755", brand: "DELL" }, ST)), "სერვერები");
  assert.equal(leaf(refineCategory({ name: "12-Bay TurboNAS (8 x 3.5\" HDD + 4 x 2.5\" SSD), DDR4 ECC", brand: "QNAP", model: "TVS-h1288X" }, ST)), "NAS სერვერები");
  assert.equal(leaf(refineCategory({ name: "2-bay, ARM Cortex-A55 quad-core 2.0 GHz processor, 2 GB RAM", brand: "QNAP", model: "TS-233" }, ST)), "NAS სერვერები");
  assert.equal(leaf(refineCategory({ name: "Dual M.2 PCIe SSD expansion card", brand: "QNAP", model: "QM2-2P-344A" }, ST)), "სერვერის და NAS კომპონენტები");
  assert.equal(leaf(refineCategory({ name: "HPE MSA 10Gb Short Range iSCSI SFP+ 4-pack Transceiver", brand: "HPE" }, ST)), "SFP მოდულები");
});

test("UPS: ტიპი მოდელით, აქსესუარი და აკუმულატორი ცალკე", () => {
  assert.equal(leaf(refineCategory({ name: "APC Back-UPS 1200VA, 230V, AVR", model: "BX1200MI-GR" }, UPS)), "Line Interactive UPS");
  assert.equal(leaf(refineCategory({ name: "APC Easy UPS 2000VA 230V", model: "SRV2KI" }, UPS)), "On-Line UPS");
  // „with RailKit“ უწყვეტი კვების წყაროა, „Rail kit for…“ — აქსესუარი
  assert.equal(leaf(refineCategory({ name: "APC Easy UPS SRV RM 1000VA 230V ,with RailKit", model: "SRV1KRIRK" }, UPS)), "On-Line UPS");
  assert.equal(leaf(refineCategory({ name: "Delta Electronics Rail kit for standard RT model", model: "3313489100-S35" }, UPS)), "UPS აქსესუარები");
  assert.equal(leaf(refineCategory({ name: "ENOT NP7.0-12 battery 12V 7Ah", brand: "ENOT" }, UPS)), "ტყვია-მჟავას აკუმულატორები");
  assert.equal(leaf(refineCategory({ name: "Delta Electronics Meter PDU,Half rack,200/240 Vac, 32A" }, UPS)), "კვების გამანაწილებლები (PDU)");
});

test("სვიჩები: მართვადი/არამართვადი და PoE", () => {
  assert.equal(leaf(refineCategory({ name: "Grandstream GWN7700P, Unmanaged Network Switches, 5-ports, PoE", model: "GWN7700P" }, LANSW)), "არამართვადი PoE სვიჩები (LAN)");
  assert.equal(leaf(refineCategory({ name: "Grandstream GWN7700, Unmanaged Network Switches, 5-ports", model: "GWN7700" }, LANSW)), "არამართვადი სვიჩები");
  assert.equal(leaf(refineCategory({ name: "H3C S1600V2-18P-HPWR L2 Ethernet Switch with 16 PoE+ Ports", model: "9801A67U" }, LANSW)), "მართვადი PoE სვიჩები (LAN)");
  // „18P“ პორტების რაოდენობაა, PoE არ არის
  assert.equal(leaf(refineCategory({ name: "H3C S1600V2-18P L2 Ethernet Switch with 16*10/100/1000BASE-T Ports", model: "9801A682" }, LANSW)), "მართვადი სვიჩები");
});

test("კარადები: ზომით და აქსესუარებით", () => {
  assert.equal(leaf(refineCategory({ name: "საკომუნიკაციო კარადა - 9U 600x600mm" }, RACK)), "კედლის კარადები");
  assert.equal(leaf(refineCategory({ name: "42U GTS სერია სერვერის კარადა (რეკი) 600x1000 მმ" }, RACK)), "დასადგამი კარადები");
  assert.equal(leaf(refineCategory({ name: "Easy PDU, Basic, 1U, 16A, 230V, (8)C13" }, RACK)), "კვების გამანაწილებლები (PDU)");
  assert.equal(leaf(refineCategory({ name: "Temperature / humidity sensor for metered PDU LCS" }, RACK)), "კარადის აქსესუარები");
  assert.equal(leaf(refineCategory({ name: "დამხშობი პანელი - 1U 19\", Mirsan" }, RACK)), "კარადის აქსესუარები");
});

test("ვიდეო-მეთვალყურეობა: კამერა, ჩამწერი, სამაგრი", () => {
  assert.equal(leaf(refineCategory({ name: "3მპ მოძრავი WI-FI კამერა 4.0მმ ლინზით", brand: "Uniarch" }, VIDEO)), "IP კამერები");
  assert.equal(leaf(refineCategory({ name: "8 არხიანი ჩამწერი 1 სატა ინტერფეისით", model: "XVR301-08G3" }, VIDEO)), "ანალოგური ვიდეო-ჩამწერები (DVR/XVR)");
  // „კამერის/კამერებისთვის“ სამაგრია და არა კამერა
  assert.equal(leaf(refineCategory({ name: "ბულეტ კამერის ბოძზე სამაგრი" }, VIDEO)), "სამაგრები და აქსესუარები");
});

test("სწორ ადგილას მყოფს და წესის გარეშე კატეგორიას არ ეხება", () => {
  assert.equal(refineCategory({ name: "SSD დისკი 512GB" }, ["მონაცემთა შენახვა", "SSD დისკები"]), null);
  assert.equal(refineCategory({ name: "რაღაც უცნობი" }, ST), null);
  assert.equal(refineCategory({ name: "Embryo Transfer Catheter", brand: "Laboratoire CCD" }, ["დაუკატეგორიებელი (იმპორტი)"]), null);
});

test("რამდენიმე ნაბიჯი: LAN კომპონენტები → კაბელები → 100% სპილენძით", () => {
  assert.deepEqual(
    refineCategory({ name: "AMP Cable U/UTP, Cat.6 LSZH, 305 m", brand: "Commscope" }, ["LAN & WAN", "LAN კომპონენტები"]),
    ["LAN & WAN", "LAN კაბელები", "LAN კაბელები 100% სპილენძით"]
  );
});
