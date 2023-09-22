import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { ErrorMessages, InputBox } from "../../components";
import { ApiHelper, DateHelper } from "../../helpers";
import { FundDonationInterface, FundInterface, PersonInterface, StripeDonationInterface, StripePaymentMethod, UserInterface, ChurchInterface } from "../../interfaces";
import { FundDonations } from "./FundDonations";
import { Grid, Alert, TextField, Button, FormControl, InputLabel, Select, MenuItem, PaperProps } from "@mui/material"
import { DonationHelper } from "../../helpers/DonationHelper";

interface Props { churchId: string, mainContainerCssProps?: PaperProps, showHeader?: boolean, recaptchaSiteKey: string, churchLogo?: string }

export const NonAuthDonationInner: React.FC<Props> = ({ mainContainerCssProps, showHeader = true, ...props }) => {
  const stripe = useStripe();
  const elements = useElements();
  const formStyling = { style: { base: { fontSize: "18px" } } };
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [amount, setAmount] = React.useState(0);
  const [errors, setErrors] = React.useState([]);
  const [fundDonations, setFundDonations] = React.useState<FundDonationInterface[]>([]);
  const [funds, setFunds] = React.useState<FundInterface[]>([]);
  const [donationComplete, setDonationComplete] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [donationType, setDonationType] = useState<"once" | "recurring">("once");
  const [interval, setInterval] = useState("one_month");
  const [startDate, setStartDate] = useState(new Date().toDateString());
  const [captchaResponse, setCaptchaResponse] = useState("");
  const [church, setChurch] = useState<ChurchInterface>();
  const captchaRef = useRef(null);

  const init = () => {
    ApiHelper.get("/funds/churchId/" + props.churchId, "GivingApi").then(data => {
      setFunds(data);
      if (data.length) setFundDonations([{ fundId: data[0].id }]);
    });
    ApiHelper.get("/churches/" + props.churchId, "MembershipApi").then(data => {
      setChurch(data);
    });
  }

  const handleCaptchaChange = (value: string) => {
    const captchaToken = captchaRef.current.getValue();
    ApiHelper.postAnonymous("/donate/captcha-verify", { token: captchaToken }, "GivingApi").then((data) => { setCaptchaResponse(data.response); })
  }

  const handleSave = async () => {
    if (validate()) {
      setProcessing(true);
      ApiHelper.post("/users/loadOrCreate", { userEmail: email, firstName, lastName }, "MembershipApi")
        .catch(ex => { setErrors([ex.toString()]); setProcessing(false); })
        .then(async userData => {
          const personData = { churchId: props.churchId, firstName, lastName, email };
          const person = await ApiHelper.post("/people/loadOrCreate", personData, "MembershipApi")
          saveCard(userData, person)
        });
    }
  }

  const saveCard = async (user: UserInterface, person: PersonInterface) => {
    const cardData = elements.getElement(CardElement);
    const stripePM = await stripe.createPaymentMethod({ type: "card", card: cardData });
    if (stripePM.error) { setErrors([stripePM.error.message]); setProcessing(false); }
    else {
      const pm = { id: stripePM.paymentMethod.id, personId: person.id, email: email, name: person.name.display, churchId: props.churchId }
      await ApiHelper.post("/paymentmethods/addcard", pm, "GivingApi").then(result => {
        if (result?.raw?.message) {
          setErrors([result.raw.message]);
          setProcessing(false);
        } else {
          const d: { paymentMethod: StripePaymentMethod, customerId: string } = result;
          saveDonation(d.paymentMethod, d.customerId, person);
        }
      });
    }
  }

  const saveDonation = async (paymentMethod: StripePaymentMethod, customerId: string, person?: PersonInterface) => {
    let donation: StripeDonationInterface = {
      amount: amount,
      id: paymentMethod.id,
      customerId: customerId,
      type: paymentMethod.type,
      churchId: props.churchId,
      funds: [],
      person: {
        id: person?.id,
        email: person?.contactInfo?.email,
        name: person?.name?.display
      }
    }

    if (donationType === "recurring") {
      donation.billing_cycle_anchor = + new Date(startDate);
      donation.interval = DonationHelper.getInterval(interval);
    }

    for (const fundDonation of fundDonations) {
      let fund = funds.find((fund: FundInterface) => fund.id === fundDonation.fundId);
      donation.funds.push({ id: fundDonation.fundId, amount: fundDonation.amount || 0, name: fund.name });
    }

    const churchObj = {
      name: church.name,
      subDomain: church.subDomain,
      churchURL: typeof window !== "undefined" && window.location.origin,
      logo: props?.churchLogo
    }

    let results;
    if (donationType === "once") results = await ApiHelper.post("/donate/charge/", { ...donation, church: churchObj }, "GivingApi");
    if (donationType === "recurring") results = await ApiHelper.post("/donate/subscribe/", { ...donation, church: churchObj }, "GivingApi");

    if (results?.status === "succeeded" || results?.status === "pending" || results?.status === "active") {
      setDonationComplete(true)
    }
    if (results?.raw?.message) {
      setErrors([results?.raw?.message]);
      setProcessing(false);
    }
    setProcessing(false);
  }

  const validate = () => {
    const result = [];
    if (!firstName) result.push("Please enter your first name.");
    if (!lastName) result.push("Please enter your last name.");
    if (!email) result.push("Please enter your email address.");
    if (amount === 0) result.push("Amount cannot be $0");
    if (result.length === 0) {
      if (!email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)) result.push("Please enter a valid email address");  //eslint-disable-line
    }
    //Todo - make sure the account doesn't exist. (loadOrCreate?)
    setErrors(result);
    return result.length === 0;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.currentTarget.value;
    switch (e.currentTarget.name) {
      case "firstName": setFirstName(val); break;
      case "lastName": setLastName(val); break;
      case "email": setEmail(val); break;
      case "startDate": setStartDate(val); break;
      case "interval": setInterval(val); break;
    }
  }

  const handleFundDonationsChange = (fd: FundDonationInterface[]) => {
    setFundDonations(fd);
    let totalAmount = 0;
    let selectedFunds: any = [];
    for (const fundDonation of fd) {
      totalAmount += fundDonation.amount || 0;
      let fund = funds.find((fund: FundInterface) => fund.id === fundDonation.fundId);
      selectedFunds.push({ id: fundDonation.fundId, amount: fundDonation.amount || 0, name: fund.name });
    }
    setAmount(totalAmount);
  }

  const getFundList = () => {
    if (funds) return (<>
      <hr />
      <h4>Funds</h4>
      <FundDonations fundDonations={fundDonations} funds={funds} updatedFunction={handleFundDonationsChange} />
    </>);
  }

  React.useEffect(init, []); //eslint-disable-line

  if (donationComplete) return <Alert severity="success">Thank you for your donation.</Alert>
  else return (
    <InputBox headerIcon={showHeader ? "volunteer_activism" : ""} headerText={showHeader ? "Donate" : ""} saveFunction={handleSave} saveText="Donate" isSubmitting={processing || !captchaResponse || captchaResponse === "robot"} mainContainerCssProps={mainContainerCssProps}>
      <ErrorMessages errors={errors} />
      <Grid container spacing={3}>
        <Grid item md={6} xs={12}>
          <Button aria-label="single-donation" size="small" fullWidth style={{ minHeight: "50px" }} variant={donationType === "once" ? "contained" : "outlined"} onClick={() => setDonationType("once")}>Make a Donation</Button>
        </Grid>
        <Grid item md={6} xs={12}>
          <Button aria-label="recurring-donation" size="small" fullWidth style={{ minHeight: "50px" }} variant={donationType === "recurring" ? "contained" : "outlined"} onClick={() => setDonationType("recurring")}>Make a Recurring Donation</Button>
        </Grid>
        <Grid item md={6} xs={12}>
          <TextField fullWidth label="First Name" name="firstName" value={firstName} onChange={handleChange} />
        </Grid>
        <Grid item md={6} xs={12}>
          <TextField fullWidth label="Last Name" name="lastName" value={lastName} onChange={handleChange} />
        </Grid>
        <Grid item md={6} xs={12}>
          <TextField fullWidth label="Email" name="email" value={email} onChange={handleChange} />
        </Grid>
        <Grid item md={6} xs={12}>
          <ReCAPTCHA sitekey={props.recaptchaSiteKey} ref={captchaRef} onChange={handleCaptchaChange} />
        </Grid>
      </Grid>
      <div style={{ padding: 10, border: "1px solid #CCC", borderRadius: 5, marginTop: 10 }}>
        <CardElement options={formStyling} />
      </div>
      {donationType === "recurring"
        && <Grid container spacing={3} style={{marginTop:0}}>
          <Grid item md={6} xs={12}>
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select label="Frequency" name="interval" aria-label="interval" value={interval} onChange={(e) => {setInterval(e.target.value) }}>
                <MenuItem value="one_week">Weekly</MenuItem>
                <MenuItem value="two_week">Bi-Weekly</MenuItem>
                <MenuItem value="one_month">Monthly</MenuItem>
                <MenuItem value="three_month">Quarterly</MenuItem>
                <MenuItem value="one_year">Annually</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item md={6} xs={12}>
            <TextField fullWidth name="startDate" type="date" aria-label="startDate" label="Start Date" value={DateHelper.formatHtml5Date(new Date(startDate))} onChange={handleChange} />
          </Grid>
        </Grid>
      }
      {getFundList()}
    </InputBox>
  );
}
